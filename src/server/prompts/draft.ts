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

  const toneInstruction = buildToneInstruction({
    tone: toneChange || tone,
    docTypeId: caseState.docType,
    documentLang: letterLang,
  });

  const systemPrompt = `You are Munshi's Master Scribe and Drafting Engine.
Your task is to draft, edit, or adjust a piece of writing with high stylistic quality in language "${letterLang}".

DOCUMENT CONFIGURATION:
- Writing Type: "${caseState.docType}"
- Target Layout: "${layout}" (letter, email, prose, or verse)
- Required Skeleton of Block Roles in order: [${skeleton.join(', ')}]
- Today's Date: "${today}"

${toneInstruction}

IMPORTANT RULES:
1. Strict Fidelity to Facts: Never invent facts, phone numbers, email addresses, or amounts.
2. Layout Rules:
   - For 'email' layout: include 'subject', 'salutation', 'body', 'closing'. Do NOT include postal address headers.
   - For 'letter' layout: include formal 'sender', 'date', 'recipient', 'subject', 'salutation', 'body', 'closing', 'enclosures' as required.
   - For 'verse' layout: format each 'stanza' block with line breaks intact.
   - For 'prose' layout: format into 'title', 'heading', and 'body' blocks.
3. Tone Invariant: If adjusting tone or editing, maintain every number, date, and fact exactly as originally established.
4. Output Format: Return ONLY a valid JSON object matching the schema: { "blocks": [ { "role": "...", "text": "...", "evidenceSnippet": "..." } ] }`;

  const userParts: string[] = [];

  if (instruction && currentDraft) {
    userParts.push(`USER EDIT INSTRUCTION: "${instruction}"`);
    userParts.push(`CURRENT DRAFT TO EDIT:`);
    currentDraft.blocks.forEach((b) => {
      userParts.push(`- Role: ${b.role} (Locked: ${b.locked || false})\n  Text: "${b.text}"`);
    });
  } else if (toneChange && currentDraft) {
    userParts.push(
      `TASK: REGENERATE BODY BLOCKS ONLY IN THE NEW TONE. Keep non-body blocks and facts identical.`,
    );
    userParts.push(`CURRENT DRAFT:`);
    currentDraft.blocks.forEach((b) => {
      userParts.push(`- Role: ${b.role}\n  Text: "${b.text}"`);
    });
  } else {
    userParts.push(
      mode === 'rewrite'
        ? `TASK: REWRITE DRAFT IN TARGET LANGUAGE "${letterLang}" FROM FACTS.`
        : `TASK: DRAFT NEW DOCUMENT FROM FACTS AND EVIDENCE.`,
    );
  }

  // Supply facts
  userParts.push(`ESTABLISHED FACTS:`);
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
    userParts.push(`USER SPEECH TRANSCRIPTS:`);
    caseState.segments.forEach((s) => userParts.push(`"${s.text}"`));
  }

  if (caseState.customBrief) {
    userParts.push(`USER BRIEF: "${caseState.customBrief}"`);
  }

  userParts.push(`Generate the complete draft blocks now and return JSON.`);

  return {
    systemPrompt,
    userPrompt: userParts.join('\n\n'),
  };
}
