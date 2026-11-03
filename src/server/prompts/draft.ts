/**
 * Prompt builders for drafting, editing, tone adjustment, and rewrites (BE-12, BE-13).
 */
import { buildToneInstruction } from './tone';
import {
  type CaseState,
  type Draft,
  type ToneChoice,
  BlockRoleSchema,
} from '@/contracts';
import { getDocType } from '@/config/doctypes';
import { getLanguage } from '@/config/languages';
import { z } from 'zod';

export const DraftLlmOutputSchema = z.object({
  blocks: z.array(
    z.object({
      role: BlockRoleSchema,
      text: z.string(),
      evidenceSnippet: z.string().optional(),
    }),
  ),
});

export type DraftLlmOutput = z.infer<typeof DraftLlmOutputSchema>;

export function buildDraftPrompt(options: {
  caseState: CaseState;
  letterLang: string;
  tone: ToneChoice;
  params: Record<string, string | number | boolean>;
  today: string;
  mode?: 'rewrite';
  instruction?: string;
  toneChange?: ToneChoice;
  currentDraft?: Draft;
}): { systemPrompt: string; userPrompt: string } {
  const {
    caseState,
    letterLang,
    tone,
    params,
    today,
    mode,
    instruction,
    toneChange,
    currentDraft,
  } = options;

  const docDef = getDocType(caseState.docType);
  const layout = caseState.customDef?.layout || docDef?.layout || 'letter';
  const skeleton = caseState.customDef?.skeleton || docDef?.skeleton || ['body'];

  const targetLangDef = getLanguage(letterLang);
  const targetLangLabel = targetLangDef
    ? `${targetLangDef.label} (${targetLangDef.nativeLabel})`
    : letterLang;
  const targetLangScript = targetLangDef?.script || 'Latin';

  const inputLangDef = getLanguage(caseState.inputLang);
  const inputLangLabel = inputLangDef
    ? `${inputLangDef.label} (${inputLangDef.nativeLabel})`
    : caseState.inputLang;

  const toneInstruction = buildToneInstruction({
    tone: toneChange || tone,
    docTypeId: caseState.docType,
    documentLang: letterLang,
  });

  const systemPrompt = `You are Munshi's Master Scribe and Drafting Engine.

TARGET DOCUMENT LANGUAGE SPECIFICATION:
- Target Language: ${targetLangLabel} (code: "${letterLang}")
- Target Script: ${targetLangScript}
- CRITICAL MANDATORY LANGUAGE INSTRUCTION:
  You MUST compose EVERY block of the output document strictly in ${targetLangLabel} using the ${targetLangScript} script.
  Even if the user spoke in another language (e.g. ${inputLangLabel}), or if the extracted facts, notes, transcripts, or uploaded files are in Gujarati, Hindi, Marathi, etc., you MUST TRANSLATE and draft the complete document in ${targetLangLabel}.
  Do NOT leave any block text in the source input language if the target language is different.

DOCUMENT CONFIGURATION:
- Writing Type: "${caseState.docType}"
- Target Layout: "${layout}" (letter, email, prose, or verse)
- Required Skeleton of Block Roles in order: [${skeleton.join(', ')}]
- Today's Date: "${today}"

${toneInstruction}

IMPORTANT RULES:
1. Target Language Strictness: Every block (sender, recipient, subject, salutation, body, closing, enclosures) MUST be composed in ${targetLangLabel}.
2. Strict Fidelity to Facts: Never invent facts, phone numbers, email addresses, or amounts. Accurately translate and express established facts in ${targetLangLabel} while preserving numbers, dates, references, and amounts exactly.
3. Layout Rules:
   - For 'email' layout: include 'subject', 'salutation', 'body', 'closing'. Do NOT include postal address headers.
   - For 'letter' layout: include formal 'sender', 'date', 'recipient', 'subject', 'salutation', 'body', 'closing', 'enclosures' as required.
   - For 'verse' layout: format each 'stanza' block with line breaks intact.
   - For 'prose' layout: format into 'title', 'heading', and 'body' blocks.
4. Tone Invariant: If adjusting tone or editing, maintain every number, date, and fact exactly as originally established.
5. Output Format: Return ONLY a valid JSON object matching the schema: { "blocks": [ { "role": "...", "text": "...", "evidenceSnippet": "..." } ] }`;

  const userParts: string[] = [];

  if (instruction && currentDraft) {
    userParts.push(`USER EDIT INSTRUCTION: "${instruction}"`);
    userParts.push(`CURRENT DRAFT TO EDIT (Target Language: ${targetLangLabel}):`);
    currentDraft.blocks.forEach((b) => {
      userParts.push(`- Role: ${b.role} (Locked: ${b.locked || false})\n  Text: "${b.text}"`);
    });
  } else if (toneChange && currentDraft) {
    userParts.push(
      `TASK: REGENERATE BODY BLOCKS ONLY IN THE NEW TONE IN ${targetLangLabel.toUpperCase()}. Keep non-body blocks and facts identical.`,
    );
    userParts.push(`CURRENT DRAFT:`);
    currentDraft.blocks.forEach((b) => {
      userParts.push(`- Role: ${b.role}\n  Text: "${b.text}"`);
    });
  } else {
    userParts.push(
      mode === 'rewrite'
        ? `TASK: REWRITE DRAFT ENTIRELY IN ${targetLangLabel.toUpperCase()} ("${letterLang}") FROM FACTS.`
        : `TASK: DRAFT NEW DOCUMENT ENTIRELY IN ${targetLangLabel.toUpperCase()} ("${letterLang}") FROM FACTS AND EVIDENCE.`,
    );
  }

  // Supply facts
  userParts.push(`ESTABLISHED FACTS (Translate meaning accurately into ${targetLangLabel}):`);
  if (caseState.facts.length === 0) {
    userParts.push(`(No structured facts extracted. Use user speech/brief.)`);
  } else {
    caseState.facts.forEach((f) => {
      userParts.push(`- ${f.label} (${f.key}): "${f.value}" (Status: ${f.status})`);
    });
  }

  // Supply user inputs / parameters
  if (Object.keys(params).length > 0) {
    userParts.push(`TYPE PARAMETERS:\n${JSON.stringify(params, null, 2)}`);
  }

  // Supply speech / document excerpts
  if (caseState.segments.length > 0) {
    userParts.push(`USER SPEECH TRANSCRIPTS (Spoken in ${inputLangLabel}):`);
    caseState.segments.forEach((s) => userParts.push(`"${s.text}"`));
  }

  if (caseState.customBrief) {
    userParts.push(`USER BRIEF: "${caseState.customBrief}"`);
  }

  userParts.push(`Generate the complete draft blocks in ${targetLangLabel} now and return JSON.`);

  return {
    systemPrompt,
    userPrompt: userParts.join('\n\n'),
  };
}
