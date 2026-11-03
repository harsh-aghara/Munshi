/**
 * Command intent classification prompt builder and router (BE-14).
 * Parses user voice or typed utterances into structured intents.
 */
import { tones } from '@/config/tones';
import { docTypes } from '@/config/doctypes';
import { languages } from '@/config/languages';
import {
  type CommandRequest,
  type CommandResult,
  ToneChoiceSchema,
  RecipientHintSchema,
} from '@/contracts';
import { callSarvamLlm } from './sarvam/llm';
import { z } from 'zod';

const CommandLlmOutputSchema = z.object({
  intent: z.enum([
    'EDIT',
    'TRANSLATE',
    'SET_TONE',
    'SET_DOCTYPE',
    'READ_ALOUD',
    'EXPORT',
    'SET_RECIPIENT',
    'SEND',
    'UNDO',
    'REDO',
    'UNKNOWN',
  ]),
  instruction: z.string().optional(),
  targetLang: z.string().optional(),
  tone: ToneChoiceSchema.optional(),
  docType: z.string().optional(),
  recipientHint: RecipientHintSchema.optional(),
});

type CommandLlmOutput = z.infer<typeof CommandLlmOutputSchema>;

export async function routeCommand(
  request: CommandRequest,
): Promise<CommandResult> {
  const { text, draft, case: caseState } = request;

  const toneCatalog = tones.map((t) => `${t.id} (${t.labelKey})`).join(', ');
  const docTypeCatalog = docTypes.map((d) => d.id).join(', ');
  const langCatalog = languages.map((l) => `${l.code} (${l.label})`).join(', ');

  const systemPrompt = `You are Munshi's Voice and Text Command Router.
Classify the user's command into one of the following structured intents:

INTENTS:
1. "EDIT": User wants to revise or edit the wording (e.g. "change line 2 to say...", "mention my policy number")
   - Return: { "intent": "EDIT", "instruction": "<what to change>" }
2. "TRANSLATE": User wants to translate to another language (e.g. "translate to Marathi", "convert to Hindi")
   - Return: { "intent": "TRANSLATE", "targetLang": "<BCP-47 code from catalog>" }
3. "SET_TONE": User wants to adjust the tone (e.g. "make it firmer", "make it more polite", "rewrite in urgent tone")
   - Return: { "intent": "SET_TONE", "tone": { "id": "<toneId>" } } or { "intent": "SET_TONE", "tone": { "custom": "<desc>" } }
4. "SET_DOCTYPE": User wants to switch writing type (e.g. "turn this into an email", "change to RTI")
   - Return: { "intent": "SET_DOCTYPE", "docType": "<docTypeId>" }
5. "SET_RECIPIENT": User specifies who to send to (e.g. "send to HDFC Bank Connaught Place", "to Commissioner of Police")
   - Return: { "intent": "SET_RECIPIENT", "recipientHint": { "raw": "...", "org": "...", "dept": "...", "location": "..." } }
6. "READ_ALOUD": User asks to speak or read the document aloud (e.g. "read it to me", "play audio")
   - Return: { "intent": "READ_ALOUD" }
7. "EXPORT": User asks to download or export as PDF (e.g. "download PDF", "export this")
   - Return: { "intent": "EXPORT" }
8. "SEND": User asks to send or open email app (e.g. "send this", "open mail")
   - Return: { "intent": "SEND" }
9. "UNDO": User says "undo" or "go back"
   - Return: { "intent": "UNDO" }
10. "REDO": User says "redo" or "revert undo"
    - Return: { "intent": "REDO" }
11. "UNKNOWN": Any command that cannot be confidently mapped to the above intents.
    - Return: { "intent": "UNKNOWN" }

CATALOGS:
- Tone IDs: ${toneCatalog}
- DocType IDs: ${docTypeCatalog}
- Language codes: ${langCatalog}

Current Document Language: ${draft.lang}
Current Writing Type: ${draft.docType}

Return ONLY valid JSON matching the schema.`;

  try {
    const output = await callSarvamLlm<CommandLlmOutput>({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Command: "${text}"` },
      ],
      schema: CommandLlmOutputSchema,
      temperature: 0.1,
    });

    switch (output.intent) {
      case 'EDIT':
        return {
          intent: 'EDIT',
          instruction: output.instruction || text,
        };
      case 'TRANSLATE':
        return {
          intent: 'TRANSLATE',
          targetLang: output.targetLang || draft.lang,
        };
      case 'SET_TONE':
        return {
          intent: 'SET_TONE',
          tone: output.tone || { id: 'formal' },
        };
      case 'SET_DOCTYPE':
        return {
          intent: 'SET_DOCTYPE',
          docType: output.docType || draft.docType,
        };
      case 'SET_RECIPIENT':
        return {
          intent: 'SET_RECIPIENT',
          hint: output.recipientHint || { raw: text, org: text },
        };
      case 'READ_ALOUD':
        return { intent: 'READ_ALOUD' };
      case 'EXPORT':
        return { intent: 'EXPORT' };
      case 'SEND':
        return { intent: 'SEND' };
      case 'UNDO':
        return { intent: 'UNDO' };
      case 'REDO':
        return { intent: 'REDO' };
      case 'UNKNOWN':
      default:
        return { intent: 'UNKNOWN' };
    }
  } catch {
    // PRD BE-5: on command routing failure, fall back to UNKNOWN
    return { intent: 'UNKNOWN' };
  }
}
