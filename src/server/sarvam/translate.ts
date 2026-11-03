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

export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> {
  if (!text || !text.trim()) return text;

  const res = await sarvamFetch<SarvamTranslateResponse>(
    '/translate',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: text,
        source_language_code: sourceLang,
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
          const transLine = await translateText(line, draft.lang, targetLang);
          translatedLines.push(transLine);
        }
      }
      translatedText = translatedLines.join('\n');
    } else {
      translatedText = await translateText(block.text, draft.lang, targetLang);
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
