/**
 * Tone engine (BE-18).
 * Builds style instructions from tone guidance, document language register rules,
 * and custom tone text. Validates tone against doctype allowed tones.
 */
import { getTone, isToneAllowedForType, type CategoryId } from '@/config/tones';
import { getLanguage } from '@/config/languages';
import { getDocType } from '@/config/doctypes';
import type { ToneChoice } from '@/contracts';
import { AppError } from '../errors';

/**
 * Sanitizes untrusted user-supplied tone text (max 120 chars, removes prompt delimiters).
 */
export function sanitizeCustomTone(raw: string): string {
  return raw
    .slice(0, 120)
    .replace(/[<>{}[\]]/g, '')
    .trim();
}

export interface BuildTonePromptOptions {
  tone: ToneChoice;
  docTypeId: string;
  documentLang: string;
}

/**
 * Builds the style and tone instruction section for the LLM prompt.
 * Enforces allowedTones validation.
 */
export function buildToneInstruction(options: BuildTonePromptOptions): string {
  const { tone, docTypeId, documentLang } = options;
  const docType = getDocType(docTypeId);

  // 1. Validation against doctype allowed tones
  if (docType && docType.allowedTones !== 'all') {
    if ('id' in tone) {
      const allowed = isToneAllowedForType(
        tone.id,
        docType.allowedTones,
        docType.category as CategoryId,
      );
      if (!allowed) {
        throw new AppError(
          'VALIDATION_FAILED',
          `Tone '${tone.id}' is not permitted for writing type '${docTypeId}'.`,
        );
      }
    }
  }

  const parts: string[] = [];

  // 2. Tone guidance
  if ('id' in tone) {
    const toneDef = getTone(tone.id);
    if (!toneDef) {
      throw new AppError('VALIDATION_FAILED', `Unknown tone ID: '${tone.id}'.`);
    }
    parts.push(`Tone: ${toneDef.labelKey} (${tone.id})`);
    parts.push(`Style Guidance: ${toneDef.guidance}`);
  } else if ('custom' in tone) {
    const sanitized = sanitizeCustomTone(tone.custom);
    if (!sanitized) {
      throw new AppError(
        'VALIDATION_FAILED',
        'Custom tone description cannot be empty.',
      );
    }
    parts.push(`User-Specified Custom Tone: "${sanitized}"`);
    parts.push(
      `Style Guidance: Adopt the style described by the user above, maintaining high natural fluency.`,
    );
  }

  // 3. Document language register rules (from /config/languages.ts)
  const langDef = getLanguage(documentLang);
  if (langDef?.registerRules) {
    parts.push(`Language Honorific & Register Rules for ${langDef.label}:`);
    parts.push(langDef.registerRules);
  }

  // 4. Invariant constraint
  parts.push(
    `CRITICAL INVARIANT: Tone adjustments must alter STYLE and REGISTER only. Do NOT alter facts, numbers, dates, references, or amounts.`,
  );

  return parts.join('\n');
}
