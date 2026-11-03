/**
 * Case state processor and understanding pipeline (BE-9, BE-11).
 */
import { callSarvamLlm } from './sarvam/llm';
import {
  buildUnderstandSystemPrompt,
  buildUnderstandUserPrompt,
  UnderstandLlmOutputSchema,
  type UnderstandLlmOutput,
} from './prompts/understand';
import {
  type CaseState,
  type Fact,
  type Evidence,
  type MissingFact,
  type UnderstandRequest,
} from '@/contracts';
import { getDocType } from '@/config/doctypes';
import { verifyEvidenceSnippet } from './extract';
import { translateText } from './sarvam/translate';
import { planWebSearch } from './search/planner';
import { searchWebForGrounding } from './search';
import { type Contact } from '@/contracts';

export async function processUnderstand(
  request: UnderstandRequest,
): Promise<CaseState> {
  const {
    docTypeId,
    customBrief,
    params = {},
    segments,
    docs,
    inputLang,
    previousCase,
    answers,
  } = request;

  // Determine current round
  const prevRound = previousCase?.round ?? 0;
  const currentRound = answers ? prevRound + 1 : prevRound;

  // Combine full source text for verbatim verification
  const speechText = segments.map((s) => s.text).join(' ');
  const docsText = docs.map((d) => d.markdown).join('\n');
  const userInputText = [speechText, customBrief].filter(Boolean).join(' ').trim();

  // 1. Dynamic Web Search Grounding (extract only relevant factual content from internet)
  let webGroundingContext = '';
  const webContacts: Contact[] = [];

  if (userInputText && process.env.SEARCH_API_KEY) {
    try {
      const searchPlan = await planWebSearch(userInputText, { docTypeId });
      if (searchPlan.needsSearch && searchPlan.queries.length > 0) {
        const searchResults = await Promise.allSettled(
          searchPlan.queries.slice(0, 2).map((q) =>
            searchWebForGrounding(q, { targetEntity: searchPlan.targetEntity }),
          ),
        );

        const answersList: string[] = [];
        const snippetsList: string[] = [];

        for (const res of searchResults) {
          if (res.status === 'fulfilled') {
            const data = res.value;
            if (data.answer) answersList.push(data.answer);
            for (const r of data.results) {
              if (r.snippet) snippetsList.push(`[${r.title}]: ${r.snippet}`);
            }
            for (const c of data.contacts) {
              if (!webContacts.some((existing) => existing.email === c.email)) {
                webContacts.push(c);
              }
            }
          }
        }

        if (answersList.length > 0 || snippetsList.length > 0) {
          webGroundingContext = [
            '=== VERIFIED INTERNET SEARCH CONTEXT (Real-world Grounding) ===',
            searchPlan.targetEntity ? `Target Entity / Office: "${searchPlan.targetEntity}"` : '',
            answersList.length > 0 ? `Synthesized Facts & Contacts:\n${answersList.join('\n\n')}` : '',
            snippetsList.length > 0 ? `Relevant Web Sources:\n${snippetsList.slice(0, 4).join('\n\n')}` : '',
            '=== END INTERNET SEARCH CONTEXT ===',
          ]
            .filter(Boolean)
            .join('\n\n');
        }
      }
    } catch (err) {
      console.warn('Web grounding skipped due to error:', err);
    }
  }

  const allSourceText = `${speechText}\n${docsText}\n${webGroundingContext}`;

  // Call LLM
  const systemPrompt = buildUnderstandSystemPrompt();
  const userPrompt = buildUnderstandUserPrompt({
    docTypeId,
    customBrief,
    segments,
    docs,
    inputLang,
    answers,
    previousFacts: previousCase?.facts,
    webGroundingContext: webGroundingContext || undefined,
  });

  const llmResult = await callSarvamLlm<UnderstandLlmOutput>({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    schema: UnderstandLlmOutputSchema,
    temperature: 0.1,
  });

  // Determine final docType and confidence
  let finalDocType = docTypeId;
  let docTypeSource: 'user' | 'auto' = 'user';
  let docTypeConfidence: number | undefined;

  if (docTypeId === 'auto') {
    docTypeSource = 'auto';
    finalDocType = llmResult.detectedDocTypeId || 'general_letter';
    docTypeConfidence = llmResult.docTypeConfidence ?? 0.85;
  }

  // Build evidence list
  const evidenceList: Evidence[] = [];
  const findEvidence = (snippet: string): string => {
    if (!snippet) return '';
    // Check if matching snippet already has an Evidence object
    const existing = evidenceList.find((e) => e.snippet === snippet);
    if (existing) return existing.id;

    // Check speech segments
    const matchingSeg = segments.find((s) =>
      s.text.toLowerCase().includes(snippet.toLowerCase().trim()),
    );
    if (matchingSeg) {
      const ev: Evidence = {
        id: `ev_sp_${evidenceList.length + 1}`,
        kind: 'speech',
        segmentId: matchingSeg.id,
        snippet,
      };
      evidenceList.push(ev);
      return ev.id;
    }

    // Check docs
    const matchingDoc = docs.find((d) =>
      d.markdown.toLowerCase().includes(snippet.toLowerCase().trim()),
    );
    if (matchingDoc) {
      const ev: Evidence = {
        id: `ev_doc_${evidenceList.length + 1}`,
        kind: 'document',
        docId: matchingDoc.id,
        snippet,
      };
      evidenceList.push(ev);
      return ev.id;
    }

    // Check web grounding context
    if (
      webGroundingContext &&
      webGroundingContext.toLowerCase().includes(snippet.toLowerCase().trim())
    ) {
      const ev: Evidence = {
        id: `ev_web_${evidenceList.length + 1}`,
        kind: 'document',
        snippet,
      };
      evidenceList.push(ev);
      return ev.id;
    }

    // Fallback evidence
    const ev: Evidence = {
      id: `ev_gen_${evidenceList.length + 1}`,
      kind: 'speech',
      snippet,
    };
    evidenceList.push(ev);
    return ev.id;
  };

  // Filter and build validated facts (Rule: verbatim snippet check)
  const facts: Fact[] = [];
  for (const rawFact of llmResult.extractedFacts) {
    const isVerbatim = verifyEvidenceSnippet(
      rawFact.evidenceSnippet,
      allSourceText,
    );
    // If not verbatim in source text, and not an answer provided by user, drop it per BE-8
    const isFromAnswer =
      answers && Object.values(answers).some((a) => a.includes(rawFact.value));
    if (!isVerbatim && !isFromAnswer && allSourceText.trim().length > 0) {
      continue;
    }

    const evId = findEvidence(rawFact.evidenceSnippet);

    const alternatives = rawFact.conflictAlternatives?.map((alt) => ({
      value: alt.value,
      evidenceIds: [findEvidence(alt.evidenceSnippet)],
    }));

    facts.push({
      key: rawFact.key,
      label: rawFact.label,
      value: rawFact.value,
      evidenceIds: evId ? [evId] : [],
      confidence: rawFact.confidence,
      status: rawFact.status,
      previousValue: rawFact.previousValue,
      alternatives,
    });
  }

  // Handle missing facts: limit to at most 2 per round and cap at round 2
  const missing: MissingFact[] = [];
  if (currentRound < 2) {
    const docDef = getDocType(finalDocType);
    if (docDef && docDef.grounding !== 'creative') {
      const candidateMissing = llmResult.missingFacts.slice(0, 2);
      missing.push(...candidateMissing);

      // Safety net: Guarantee follow-up questions are in the user's spoken language
      if (inputLang !== 'en-IN' && missing.length > 0) {
        for (const mf of missing) {
          // If the question is predominantly ASCII English, translate it to inputLang
          const isAsciiEnglish = /^[\x00-\x7F\s.,?!'"\-]+$/.test(mf.question.trim());
          if (isAsciiEnglish) {
            try {
              mf.question = await translateText(mf.question, 'en-IN', inputLang);
            } catch (e) {
              console.warn('Failed to translate follow-up question to inputLang', e);
            }
          }
        }
      }
    }
  }

  // Custom Def handling (BE-11)
  let customDef = llmResult.customDef;
  if (finalDocType === 'custom') {
    if (!customDef) {
      customDef = {
        label: 'Custom Document',
        layout: 'prose',
        skeleton: ['title', 'body', 'closing'],
        requiredFacts: [],
        sendable: false,
        hasRecipient: false,
      };
    } else {
      const isEmailOrLetter =
        customDef.layout === 'email' || customDef.layout === 'letter';
      customDef = {
        ...customDef,
        sendable: customDef.sendable ?? isEmailOrLetter,
        hasRecipient: customDef.hasRecipient ?? isEmailOrLetter,
      };
    }
  }

  // Deduplicate and merge contacts
  const mergedContacts: Contact[] = [...(previousCase?.contacts || [])];
  for (const c of webContacts) {
    if (!mergedContacts.some((existing) => existing.email === c.email)) {
      mergedContacts.push(c);
    }
  }

  return {
    caseId: previousCase?.caseId || `case_${Date.now()}`,
    docType: finalDocType,
    docTypeSource,
    docTypeConfidence,
    customBrief,
    customDef,
    params,
    inputLang,
    segments,
    evidence: evidenceList,
    docs,
    facts,
    missing,
    contacts: mergedContacts,
    recipientHint: llmResult.recipientHint || previousCase?.recipientHint,
    round: currentRound,
  };
}
