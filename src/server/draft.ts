/**
 * Drafting engine and streaming generator (BE-12, BE-13).
 */
import { callSarvamLlm } from './sarvam/llm';
import {
  buildDraftPrompt,
  DraftLlmOutputSchema,
  type DraftLlmOutput,
} from './prompts/draft';
import {
  type Draft,
  type DraftBlock,
  type DraftRequest,
  type DraftEvent,
} from '@/contracts';
import { getDocType } from '@/config/doctypes';
import { verifyBlockGrounding, ensureDisclaimerBlock } from './grounding';

export async function generateDraft(request: DraftRequest): Promise<{
  draft: Draft;
  changedBlockIds?: string[];
  events: DraftEvent[];
}> {
  const {
    case: caseState,
    letterLang,
    tone,
    params,
    today,
    mode,
    instruction,
    toneChange,
    currentDraft,
  } = request;

  const docDef = getDocType(caseState.docType);
  const layout = caseState.customDef?.layout || docDef?.layout || 'letter';
  const groundingPolicy = docDef?.grounding || 'facts';
  const needsDisclaimer = Boolean(docDef?.disclaimer);

  // Build prompts
  const { systemPrompt, userPrompt } = buildDraftPrompt({
    caseState,
    letterLang,
    tone,
    params,
    today,
    mode,
    instruction,
    toneChange,
    currentDraft,
  });

  const llmResult = await callSarvamLlm<DraftLlmOutput>({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    schema: DraftLlmOutputSchema,
    temperature: groundingPolicy === 'creative' ? 0.7 : 0.2,
  });

  const sourceText = `${caseState.segments.map((s) => s.text).join(' ')} ${caseState.docs.map((d) => d.markdown).join(' ')}`;
  const userFactValues = caseState.facts.map((f) => f.value);

  // Assemble and verify draft blocks
  const blocks: DraftBlock[] = [];
  const events: DraftEvent[] = [];
  const changedBlockIds: string[] = [];

  for (let i = 0; i < llmResult.blocks.length; i++) {
    const rawBlock = llmResult.blocks[i];
    const blockId = `blk_${Date.now()}_${i + 1}`;

    // Link evidence if snippet was returned
    const evidenceIds: string[] = [];
    if (rawBlock.evidenceSnippet) {
      const matchingEv = caseState.evidence.find(
        (e) =>
          e.snippet.toLowerCase() ===
          rawBlock.evidenceSnippet?.toLowerCase().trim(),
      );
      if (matchingEv) {
        evidenceIds.push(matchingEv.id);
      }
    }

    const candidateBlock: DraftBlock = {
      id: blockId,
      role: rawBlock.role,
      text: rawBlock.text,
      evidenceIds,
      grounding: 'verified',
    };

    // Apply grounding verification
    candidateBlock.grounding = verifyBlockGrounding(
      candidateBlock,
      groundingPolicy,
      sourceText,
      userFactValues,
    );

    blocks.push(candidateBlock);
    changedBlockIds.push(blockId);

    events.push({
      type: 'block',
      block: candidateBlock,
    });
  }

  // Ensure disclaimer block if applicable (BE-13: legal-style types always carry disclaimer, locked)
  const finalBlocks = ensureDisclaimerBlock(blocks, needsDisclaimer);

  const newVersion = (currentDraft?.version ?? 0) + 1;
  const finalDraft: Draft = {
    caseId: caseState.caseId,
    version: newVersion,
    lang: letterLang,
    docType: caseState.docType,
    layout,
    tone: toneChange || tone,
    blocks: finalBlocks,
  };

  events.push({
    type: 'done',
    draft: finalDraft,
    changedBlockIds,
  });

  return {
    draft: finalDraft,
    changedBlockIds,
    events,
  };
}
