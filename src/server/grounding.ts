/**
 * Grounding policies and disclaimer enforcement (BE-13, PRD Section 5.2, Section 12).
 * - strict: Every block must cite evidence; every number/id/date must match source.
 * - facts: Every user number/id/name must be preserved; foreign numbers/ids flagged unverified.
 * - creative: Invented text allowed; real emails, phone numbers, or account numbers flagged unverified.
 * - disclaimer: Locked block appended for disclaimer: true doctypes.
 */
import type { DraftBlock } from '@/contracts';
import type { GroundingPolicy } from '@/config/doctypes';
import { extractIdentifiersAndNumbers } from './sarvam/translate';

export const DISCLAIMER_TEXT =
  'Note: This document is an automatically prepared draft. Please verify all facts, details, and legal claims before sending or submitting.';

/**
 * Validates a single draft block against the chosen grounding policy and source evidence.
 */
export function verifyBlockGrounding(
  block: DraftBlock,
  policy: GroundingPolicy,
  sourceText: string,
  userFactValues: string[],
): 'verified' | 'unverified' {
  // Disclaimers are always verified
  if (block.role === 'disclaimer' || block.locked) {
    return 'verified';
  }

  const blockText = block.text || '';
  if (!blockText.trim()) return 'verified';

  if (policy === 'strict') {
    // 1. Must cite evidence
    if (!block.evidenceIds || block.evidenceIds.length === 0) {
      // Salutations or formal closings may be allowed if standard, but body/details require evidence
      if (block.role === 'body' || block.role === 'subject' || block.role === 'recipient') {
        return 'unverified';
      }
    }

    // 2. Numbers and identifiers in block must appear in source text or facts
    const blockIds = extractIdentifiersAndNumbers(blockText);
    const sourceLower = sourceText.toLowerCase();

    for (const id of blockIds) {
      const idLower = id.toLowerCase();
      const inSource = sourceLower.includes(idLower);
      const inFacts = userFactValues.some((v) => v.toLowerCase().includes(idLower));
      if (!inSource && !inFacts) {
        return 'unverified';
      }
    }

    return 'verified';
  }

  if (policy === 'facts') {
    // Numbers/identifiers in the text must either come from source or user facts
    const blockIds = extractIdentifiersAndNumbers(blockText);
    const sourceLower = sourceText.toLowerCase();

    for (const id of blockIds) {
      // Ignore common small numbers like 1, 2, 3 in bullet lists
      if (/^\d{1,2}$/.test(id)) continue;

      const idLower = id.toLowerCase();
      const inSource = sourceLower.includes(idLower);
      const inFacts = userFactValues.some((v) => v.toLowerCase().includes(idLower));
      if (!inSource && !inFacts) {
        return 'unverified';
      }
    }
    return 'verified';
  }

  if (policy === 'creative') {
    // Creative allows invented wording, but never invented real contact info/identifiers
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const phoneRegex = /(?:\+?91[\s-]?)?[6789]\d{9}\b/;
    const accountRefRegex = /\b[A-Z]{2,}\d{6,}\b/;

    if (emailRegex.test(blockText)) {
      const email = blockText.match(emailRegex)![0];
      if (!sourceText.includes(email)) return 'unverified';
    }
    if (phoneRegex.test(blockText)) {
      const phone = blockText.match(phoneRegex)![0];
      if (!sourceText.includes(phone)) return 'unverified';
    }
    if (accountRefRegex.test(blockText)) {
      const ref = blockText.match(accountRefRegex)![0];
      if (!sourceText.includes(ref)) return 'unverified';
    }
    return 'verified';
  }

  return 'verified';
}

/**
 * Appends or guarantees the locked legal disclaimer block for doctypes requiring disclaimer.
 */
export function ensureDisclaimerBlock(
  blocks: DraftBlock[],
  needsDisclaimer: boolean,
): DraftBlock[] {
  if (!needsDisclaimer) {
    // Remove disclaimer if not needed
    return blocks.filter((b) => b.role !== 'disclaimer');
  }

  const existingDisclaimer = blocks.find((b) => b.role === 'disclaimer');
  if (existingDisclaimer) {
    return blocks.map((b) =>
      b.role === 'disclaimer'
        ? {
            ...b,
            text: b.text || DISCLAIMER_TEXT,
            locked: true,
            grounding: 'verified' as const,
          }
        : b,
    );
  }

  // Append locked disclaimer
  const disclaimerBlock: DraftBlock = {
    id: `blk_disc_${Date.now()}`,
    role: 'disclaimer',
    text: DISCLAIMER_TEXT,
    evidenceIds: [],
    grounding: 'verified',
    locked: true,
  };

  return [...blocks, disclaimerBlock];
}
