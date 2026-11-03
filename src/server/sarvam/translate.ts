/**
 * Typed Sarvam Translation wrapper (BE-1, BE-15).
 * Model: Mayura / Sarvam-Translate.
 * - Translates block by block preserving evidenceIds and block alignment
 * - Checks for preservation of identifiers and numbers; flags unverified if lost
 * - Preserves verse stanza breaks
 * - Translates disclaimer, never drops it
 */
import { sarvamFetch } from './client';
import type { Draft, DraftBlock } from '@/contracts';
import { isTranslateSupported } from '@/config/languages';
import { AppError } from '../errors';

export interface SarvamTranslateResponse {
  translated_text: string;
}

/**
 * Extracts numbers and alphanumeric identifiers from a string for preservation checking.
 */
export function extractIdentifiersAndNumbers(text: string): string[] {
  // Matches numbers (including decimals/currencies), account numbers, alphanumeric codes
  const matches = text.match(/\b(?:\d+[\d.,/-]*|[A-Z0-9]{4,})\b/g) || [];
  return Array.from(new Set(matches.map((m) => m.trim())));
}

/**
 * Checks if identifiers from source are reasonably preserved in translation.
 * Also normalizes Indic digits (e.g. Hindi/Bengali numerals) to ASCII for comparison.
 */
export function areIdentifiersPreserved(
  sourceText: string,
  translatedText: string,
): boolean {
  const sourceIds = extractIdentifiersAndNumbers(sourceText);
  if (sourceIds.length === 0) return true;

  // Convert Indic numerals to ASCII for fair comparison
  const normalizeDigits = (str: string) =>
    str.replace(/[\u0966-\u096F]/g, (d) => String(d.charCodeAt(0) - 0x0966));

  const normTranslated = normalizeDigits(translatedText);

  for (const id of sourceIds) {
    const normId = normalizeDigits(id);
    if (!normTranslated.includes(normId)) {
      return false;
    }
  }
  return true;
}

/**
 * Detects predominant script/language of a text based on Unicode character blocks.
 */
export function detectScriptLanguage(text: string): string | null {
  if (!text) return null;
  if (/[\u0A80-\u0AFF]/.test(text)) return 'gu-IN'; // Gujarati
  if (/[\u0900-\u097F]/.test(text)) return 'hi-IN'; // Devanagari (Hindi/Marathi)
  if (/[\u0980-\u09FF]/.test(text)) return 'bn-IN'; // Bengali
  if (/[\u0A00-\u0A7F]/.test(text)) return 'pa-IN'; // Gurmukhi (Punjabi)
  if (/[\u0B00-\u0B7F]/.test(text)) return 'od-IN'; // Odia
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN'; // Tamil
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN'; // Telugu
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn-IN'; // Kannada
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml-IN'; // Malayalam
  if (/[a-zA-Z]/.test(text)) return 'en-IN'; // Latin / English
  return null;
}

/**
 * Checks whether text displays a clear script mismatch against expected target language.
 */
export function checkScriptMismatch(
  text: string,
  expectedLang: string,
): { hasMismatch: boolean; detectedLang?: string } {
  if (!text || !text.trim()) return { hasMismatch: false };
  const detected = detectScriptLanguage(text);
  if (!detected) return { hasMismatch: false };

  if (expectedLang === 'en-IN') {
    // If expected is English but text contains Indic script, flag mismatch
    if (detected !== 'en-IN') {
      return { hasMismatch: true, detectedLang: detected };
    }
  } else {
    // If expected is an Indic language but text is in a different Indic script, flag mismatch
    if (detected !== expectedLang && detected !== 'en-IN') {
      return { hasMismatch: true, detectedLang: detected };
    }
  }
  return { hasMismatch: false };
}

export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> {
  if (!text || !text.trim()) return text;

  // Handle case where sourceLang equals targetLang
  let effectiveSource = sourceLang;
  if (effectiveSource === targetLang) {
    const mismatch = checkScriptMismatch(text, targetLang);
    if (!mismatch.hasMismatch) {
      // Already in expected language/script, return directly without calling API
      return text;
    }
    // Content is in another script (e.g. Gujarati text inside an en-IN draft)
    effectiveSource = mismatch.detectedLang || 'auto';
  }

  // Prevent calling Sarvam with identical source and target codes (which Sarvam rejects with 400)
  if (effectiveSource === targetLang) {
    return text;
  }

  const res = await sarvamFetch<SarvamTranslateResponse>(
    '/translate',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: text,
        source_language_code: effectiveSource,
        target_language_code: targetLang,
        mode: 'formal',
        model: 'mayura:v1',
      }),
    },
    { timeoutMs: 30_000 },
  );

  return res.translated_text || text;
}

export async function translateDraft(
  draft: Draft,
  targetLang: string,
): Promise<Draft> {
  if (!isTranslateSupported(targetLang)) {
    throw new AppError(
      'UNSUPPORTED_LANGUAGE',
      `Target language '${targetLang}' is not supported for translation.`,
    );
  }

  // Determine effective source language across draft text
  const fullDraftText = draft.blocks.map((b) => b.text).join(' ');
  const mismatch = checkScriptMismatch(fullDraftText, targetLang);

  if (draft.lang === targetLang && !mismatch.hasMismatch) {
    // Already in target language and no script mismatch detected
    return draft;
  }

  const effectiveSource =
    draft.lang === targetLang
      ? mismatch.detectedLang || 'auto'
      : draft.lang;

  const translatedBlocks: DraftBlock[] = [];

  for (const block of draft.blocks) {
    // Preserve empty or whitespace blocks
    if (!block.text || !block.text.trim()) {
      translatedBlocks.push({ ...block });
      continue;
    }

    let translatedText = '';

    if (draft.layout === 'verse' && block.role === 'stanza') {
      // Verse layout: preserve line breaks across stanzas
      const lines = block.text.split('\n');
      const translatedLines: string[] = [];
      for (const line of lines) {
        if (!line.trim()) {
          translatedLines.push('');
        } else {
          const transLine = await translateText(line, effectiveSource, targetLang);
          translatedLines.push(transLine);
        }
      }
      translatedText = translatedLines.join('\n');
    } else {
      translatedText = await translateText(block.text, effectiveSource, targetLang);
    }

    // Grounding check: verify that identifiers survived
    const idsSurvive = areIdentifiersPreserved(block.text, translatedText);
    const grounding =
      block.grounding === 'verified' && idsSurvive ? 'verified' : 'unverified';

    translatedBlocks.push({
      id: `blk_tr_${Date.now()}_${translatedBlocks.length + 1}`,
      role: block.role,
      text: translatedText,
      evidenceIds: [...block.evidenceIds],
      grounding,
      locked: block.locked, // Keep locked state (especially for disclaimer)
    });
  }

  return {
    caseId: draft.caseId,
    version: draft.version + 1,
    lang: targetLang,
    docType: draft.docType,
    layout: draft.layout,
    tone: draft.tone,
    blocks: translatedBlocks,
  };
}
