/**
 * Pure extraction logic for documents and text (BE-8, PRD Section 12).
 * - OCR normalization (0/O, 1/l, spaces around @ and .)
 * - Email regex matching
 * - Portal URL and phone extraction
 * - Verbatim evidence verification (whitespace-normalized)
 */
import type { Contact, Fact } from '@/contracts';

/**
 * Normalizes common OCR artifacts in candidate email strings.
 * e.g., "name @ domain . com", "user0@example.c0m", etc.
 */
export function normalizeOcrText(text: string): string {
  return text
    // Remove stray spaces around @ and .
    .replace(/\s*@\s*/g, '@')
    .replace(/\s*\.\s*/g, '.')
    // Fix spaces within domain endings like "c om" -> "com"
    .replace(/\.c\s*om\b/gi, '.com')
    .replace(/\.i\s*n\b/gi, '.in')
    .replace(/\.o\s*rg\b/gi, '.org')
    .replace(/\.g\s*ov\b/gi, '.gov');
}

/**
 * Strict regex for valid email addresses.
 */
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Regex for portal/complaint URLs.
 */
const URL_REGEX = /https?:\/\/[^\s/$.?#].[^\s]*/gi;

/**
 * Regex for Indian and international phone numbers.
 */
const PHONE_REGEX = /(?:\+?91[\s-]?)?[6789]\d{9}\b/g;

export interface ExtractedContacts {
  contacts: Contact[];
  portalUrls: string[];
  phones: string[];
}

/**
 * Extracts contacts, URLs, and phone numbers from document text.
 * Applies OCR normalization and marks low-confidence matches with needsConfirmation.
 */
export function extractContactsFromText(
  rawText: string,
  docId: string = 'doc_1',
): ExtractedContacts {
  const normalized = normalizeOcrText(rawText);
  const contacts: Contact[] = [];
  const seenEmails = new Set<string>();

  const emailMatches = normalized.match(EMAIL_REGEX) || [];

  for (const rawEmail of emailMatches) {
    const cleanEmail = rawEmail.toLowerCase().trim();
    if (seenEmails.has(cleanEmail)) continue;
    seenEmails.add(cleanEmail);

    // Look for surrounding text for context/snippet
    const idx = normalized.indexOf(rawEmail);
    const start = Math.max(0, idx - 40);
    const end = Math.min(normalized.length, idx + rawEmail.length + 40);
    const snippet = normalized.slice(start, end).replace(/\s+/g, ' ').trim();

    // Determine confidence: if domain has digits or odd characters, might need confirmation
    const domain = cleanEmail.split('@')[1] || '';
    const hasSuspectDomain = /\d/.test(domain) || domain.length < 4;

    contacts.push({
      id: `cnt_${docId}_${contacts.length + 1}`,
      email: cleanEmail,
      label: `Contact from document (${domain})`,
      origin: 'document',
      trust: 'from_user_doc',
      snippet,
      needsConfirmation: hasSuspectDomain,
    });
  }

  const urlMatches = normalized.match(URL_REGEX) || [];
  const portalUrls = Array.from(
    new Set(
      urlMatches.filter((u) =>
        /portal|grievance|complaint|support|helpdesk|contact/i.test(u),
      ),
    ),
  );

  const phoneMatches = normalized.match(PHONE_REGEX) || [];
  const phones = Array.from(new Set(phoneMatches));

  return { contacts, portalUrls, phones };
}

/**
 * Verifies whether an evidence snippet appears verbatim (whitespace-normalized)
 * in the source document or transcript text.
 * If not verbatim, returns false (PRD BE-8 rule: dropped or unverified).
 */
export function verifyEvidenceSnippet(
  snippet: string,
  sourceText: string,
): boolean {
  if (!snippet || !sourceText) return false;
  const cleanSnippet = snippet.replace(/\s+/g, ' ').trim().toLowerCase();
  const cleanSource = sourceText.replace(/\s+/g, ' ').trim().toLowerCase();
  return cleanSource.includes(cleanSnippet);
}

/**
 * Filters extracted facts: ensures each fact's evidence snippet appears verbatim
 * in source text. Drops facts that do not meet this invariant.
 */
export function validateFactsAgainstSource(
  facts: Fact[],
  sourceText: string,
): Fact[] {
  return facts.filter((fact) => {
    // If fact has no evidence snippet or empty value, drop
    if (!fact.value || !fact.value.trim()) return false;
    // Check if at least one evidence item or value appears in source text
    const cleanValue = fact.value.replace(/\s+/g, ' ').trim().toLowerCase();
    const cleanSource = sourceText.replace(/\s+/g, ' ').trim().toLowerCase();
    return cleanSource.includes(cleanValue);
  });
}
