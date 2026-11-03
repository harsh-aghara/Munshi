/**
 * Unit tests for pure logic (PRD Section 12).
 * Run with: node --experimental-strip-types tests/pure-logic.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeOcrText,
  extractContactsFromText,
  verifyEvidenceSnippet,
} from '../src/server/extract.ts';

import {
  verifyBlockGrounding,
  ensureDisclaimerBlock,
  DISCLAIMER_TEXT,
} from '../src/server/grounding.ts';

import { isPrivateIp } from '../src/server/search/ssrf.ts';

import {
  getDocType,
  isValidDocType,
  docTypes,
} from '../src/config/doctypes.ts';

import {
  getTone,
  isValidTone,
  isToneAllowedForType,
} from '../src/config/tones.ts';

import {
  languages,
  isValidLang,
  isSttSupported,
  isTtsSupported,
  isTranslateSupported,
} from '../src/config/languages.ts';

import {
  BlockRoleSchema,
  FactSchema,
  SegmentSchema,
  CaseStateSchema,
  DraftSchema,
  CommandResultSchema,
  ApiErrorSchema,
} from '../src/contracts/index.ts';

import { formatTime } from '../src/lib/audio.ts';
import { parseSarvamSttResult } from '../src/server/sarvam/stt.ts';
import { LIMITS } from '../src/server/rate-limit.ts';

// ── 1. Email Regex & OCR Normalization ───────────────────────────────────────

test('normalizeOcrText removes spaces around @ and dots', () => {
  const ocrArtifact = 'customer . support @ company . com';
  const normalized = normalizeOcrText(ocrArtifact);
  assert.equal(normalized, 'customer.support@company.com');

  const spaceInCom = 'help@service.c om';
  assert.equal(normalizeOcrText(spaceInCom), 'help@service.com');
});

test('extractContactsFromText extracts emails and sets confidence', () => {
  const sampleDoc = `
    Electricity Board Bill
    Consumer No: 10928374
    For complaints email: support@bescom.gov.in or call 1912.
    Official portal: https://bescom.karnataka.gov.in/portal/grievance
  `;
  const result = extractContactsFromText(sampleDoc, 'doc_test');
  assert.equal(result.contacts.length, 1);
  assert.equal(result.contacts[0].email, 'support@bescom.gov.in');
  assert.equal(result.contacts[0].origin, 'document');
  assert.equal(result.contacts[0].trust, 'from_user_doc');
  assert.equal(result.contacts[0].needsConfirmation, false);
  assert.equal(result.portalUrls.length, 1);
  assert.match(result.portalUrls[0], /bescom/);
});

test('verifyEvidenceSnippet validates verbatim matches', () => {
  const source = 'My electricity bill for May was ₹1,450 instead of ₹800.';
  assert.equal(verifyEvidenceSnippet('₹1,450', source), true);
  assert.equal(verifyEvidenceSnippet('may was ₹1,450', source), true);
  // Extra spaces are normalized
  assert.equal(verifyEvidenceSnippet('May   was  ₹1,450', source), true);
  // Non-matching snippet returns false
  assert.equal(verifyEvidenceSnippet('₹2,000', source), false);
});

// ── 2. Grounding Policies (strict, facts, creative) ──────────────────────────

test('Grounding: strict policy flags unverified when evidence or facts missing', () => {
  const sourceText = 'Account 123456 has a disputed charge of ₹500.';
  const facts = ['123456', '₹500'];

  const verifiedBlock = {
    id: 'b1',
    role: 'body' as const,
    text: 'Please dispute charge of ₹500 on account 123456.',
    evidenceIds: ['ev_1'],
    grounding: 'verified' as const,
  };
  assert.equal(
    verifyBlockGrounding(verifiedBlock, 'strict', sourceText, facts),
    'verified',
  );

  // Missing evidence ID in strict policy
  const noEvidenceBlock = {
    ...verifiedBlock,
    evidenceIds: [],
  };
  assert.equal(
    verifyBlockGrounding(noEvidenceBlock, 'strict', sourceText, facts),
    'unverified',
  );

  // Invented number in strict policy
  const inventedNumberBlock = {
    ...verifiedBlock,
    text: 'Please dispute charge of ₹9,999 on account 123456.',
  };
  assert.equal(
    verifyBlockGrounding(inventedNumberBlock, 'strict', sourceText, facts),
    'unverified',
  );
});

test('Grounding: facts policy allows free wording but flags foreign numbers', () => {
  const sourceText = 'The meeting was held on 15 March with 4 participants.';
  const facts = ['15 March', '4'];

  const freeWordingBlock = {
    id: 'b2',
    role: 'body' as const,
    text: 'Four members gathered for a productive session on 15 March.',
    evidenceIds: [],
    grounding: 'verified' as const,
  };
  assert.equal(
    verifyBlockGrounding(freeWordingBlock, 'facts', sourceText, facts),
    'verified',
  );

  // Unaccounted foreign number
  const foreignNumBlock = {
    id: 'b3',
    role: 'body' as const,
    text: 'Four members met on 15 March and agreed on budget 987654.',
    evidenceIds: [],
    grounding: 'verified' as const,
  };
  assert.equal(
    verifyBlockGrounding(foreignNumBlock, 'facts', sourceText, facts),
    'unverified',
  );
});

test('Grounding: creative policy allows invented text but flags real emails/phones', () => {
  const creativeBlock = {
    id: 'b4',
    role: 'stanza' as const,
    text: 'A wandering spirit in the silent moonlight, singing dreams of tomorrow.',
    evidenceIds: [],
    grounding: 'verified' as const,
  };
  assert.equal(
    verifyBlockGrounding(creativeBlock, 'creative', '', []),
    'verified',
  );

  // Invented email in creative writing is flagged unverified
  const inventedContactBlock = {
    id: 'b5',
    role: 'stanza' as const,
    text: 'Write to the phantom at ghost@netherworld.com or call 9876543210.',
    evidenceIds: [],
    grounding: 'verified' as const,
  };
  assert.equal(
    verifyBlockGrounding(inventedContactBlock, 'creative', '', []),
    'unverified',
  );
});

// ── 3. Locked Disclaimer ────────────────────────────────────────────────────

test('ensureDisclaimerBlock appends locked disclaimer for legal types', () => {
  const initialBlocks = [
    {
      id: 'b1',
      role: 'body' as const,
      text: 'Formal RTI text.',
      evidenceIds: [],
      grounding: 'verified' as const,
    },
  ];

  const withDisclaimer = ensureDisclaimerBlock(initialBlocks, true);
  assert.equal(withDisclaimer.length, 2);
  const disc = withDisclaimer.find((b) => b.role === 'disclaimer');
  assert.ok(disc);
  assert.equal(disc.locked, true);
  assert.equal(disc.text, DISCLAIMER_TEXT);

  // Running it again preserves existing locked disclaimer
  const again = ensureDisclaimerBlock(withDisclaimer, true);
  assert.equal(again.length, 2);
});

test('ensureDisclaimerBlock strips disclaimer when disclaimer is false', () => {
  const blocksWithDisc = [
    {
      id: 'b1',
      role: 'body' as const,
      text: 'Poem stanza.',
      evidenceIds: [],
      grounding: 'verified' as const,
    },
    {
      id: 'b_disc',
      role: 'disclaimer' as const,
      text: DISCLAIMER_TEXT,
      evidenceIds: [],
      grounding: 'verified' as const,
      locked: true,
    },
  ];
  const cleaned = ensureDisclaimerBlock(blocksWithDisc, false);
  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].role, 'body');
});

// ── 4. SSRF IP Range Checks ─────────────────────────────────────────────────

test('isPrivateIp detects loopback, link-local, and RFC 1918 ranges', () => {
  // Loopback
  assert.equal(isPrivateIp('127.0.0.1'), true);
  assert.equal(isPrivateIp('127.255.0.1'), true);

  // RFC 1918
  assert.equal(isPrivateIp('10.0.0.1'), true);
  assert.equal(isPrivateIp('10.254.1.1'), true);
  assert.equal(isPrivateIp('192.168.1.1'), true);
  assert.equal(isPrivateIp('172.16.0.1'), true);
  assert.equal(isPrivateIp('172.31.255.255'), true);

  // Link-local / Cloud metadata (AWS/GCP/Azure)
  assert.equal(isPrivateIp('169.254.169.254'), true);
  assert.equal(isPrivateIp('0.0.0.0'), true);

  // Public IPs must NOT be flagged as private
  assert.equal(isPrivateIp('8.8.8.8'), false);
  assert.equal(isPrivateIp('1.1.1.1'), false);
  assert.equal(isPrivateIp('142.250.190.46'), false);

  // IPv6
  assert.equal(isPrivateIp('::1'), true);
  assert.equal(isPrivateIp('fe80::1'), true);
  assert.equal(isPrivateIp('fc00::1'), true);
});

// ── 5. Config Registries and Validation ──────────────────────────────────────

test('doctypes registry is valid and includes all required categories', () => {
  assert.ok(docTypes.length >= 15);
  assert.equal(isValidDocType('grievance'), true);
  assert.equal(isValidDocType('rti'), true);
  assert.equal(isValidDocType('internship_email'), true);
  assert.equal(isValidDocType('abstract'), true);
  assert.equal(isValidDocType('poem'), true);
  assert.equal(isValidDocType('custom'), true);
  assert.equal(isValidDocType('auto'), true);
  assert.equal(isValidDocType('non_existent_type'), false);

  const rti = getDocType('rti');
  assert.ok(rti);
  assert.equal(rti.category, 'official');
  assert.equal(rti.grounding, 'strict');
  assert.equal(rti.disclaimer, true);
  assert.equal(rti.hasRecipient, true);
});

test('tone registry validates allowed tones per type', () => {
  assert.equal(isValidTone('formal'), true);
  assert.equal(isValidTone('urgent'), true);
  assert.equal(isValidTone('poetic'), true);
  assert.equal(isValidTone('made_up_tone'), false);

  // Grievance allows formal and firm
  const grievance = getDocType('grievance')!;
  assert.equal(
    isToneAllowedForType('formal', grievance.allowedTones, grievance.category),
    true,
  );
  assert.equal(
    isToneAllowedForType('firm', grievance.allowedTones, grievance.category),
    true,
  );
  // Grievance does not allow poetic tone
  assert.equal(
    isToneAllowedForType('poetic', grievance.allowedTones, grievance.category),
    false,
  );
});

test('languages registry supports Indian languages and queries', () => {
  assert.equal(isValidLang('en-IN'), true);
  assert.equal(isValidLang('hi-IN'), true);
  assert.equal(isValidLang('gu-IN'), true);
  assert.equal(isValidLang('mr-IN'), true);
  assert.equal(isValidLang('xx-YY'), false);

  assert.equal(isSttSupported('hi-IN'), true);
  assert.equal(isTtsSupported('hi-IN'), true);
  assert.equal(isTranslateSupported('gu-IN'), true);

  const validSarvamModes = new Set(['transcribe', 'translate', 'indic-en', 'verbatim', 'translit', 'codemix']);
  for (const lang of languages) {
    if (lang.stt && lang.sttMode) {
      assert.ok(validSarvamModes.has(lang.sttMode), `Language ${lang.code} has invalid sttMode: ${lang.sttMode}`);
    }
    if (lang.tts && lang.ttsVoice) {
      assert.ok(typeof lang.ttsVoice === 'string' && lang.ttsVoice.length > 0);
    }
  }
});

// ── 6. Contracts Schema Validation ──────────────────────────────────────────

test('Zod contracts validate core domain structures', () => {
  // Segment validation
  const validSegment = SegmentSchema.safeParse({
    id: 'seg_1',
    startMs: 0,
    endMs: 1500,
    text: 'Namaste',
    lang: 'hi-IN',
  });
  assert.equal(validSegment.success, true);

  // Segment validation with null/undefined timestamps (resilience test)
  const nullSegment = SegmentSchema.safeParse({
    id: 'seg_2',
    startMs: null,
    endMs: null,
    text: 'Namaste',
    lang: 'hi-IN',
  });
  assert.equal(nullSegment.success, true);
  if (nullSegment.success) {
    assert.equal(nullSegment.data.startMs, 0);
    assert.equal(nullSegment.data.endMs, 0);
  }

  // Block role validation
  const validRole = BlockRoleSchema.safeParse('salutation');
  assert.equal(validRole.success, true);
  const invalidRole = BlockRoleSchema.safeParse('footer_widget');
  assert.equal(invalidRole.success, false);

  // Command result validation (discriminated union)
  const validCmd = CommandResultSchema.safeParse({
    intent: 'SET_TONE',
    tone: { id: 'formal' },
  });
  assert.equal(validCmd.success, true);

  // ApiError schema validation
  const validErr = ApiErrorSchema.safeParse({
    code: 'ACCESS_DENIED',
    message: 'Invalid access code',
    retryable: false,
    requestId: 'req_123',
  });
  assert.equal(validErr.success, true);
});

// ── 8. Voice Timer & STT Uncapped Duration ───────────────────────────────────

test('Recording timer: formatTime correctly converts seconds to MM:SS', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(5), '0:05');
  assert.equal(formatTime(9), '0:09');
  assert.equal(formatTime(10), '0:10');
  assert.equal(formatTime(59), '0:59');
  assert.equal(formatTime(60), '1:00');
  assert.equal(formatTime(65), '1:05');
  assert.equal(formatTime(125), '2:05');
  assert.equal(formatTime(600), '10:00');
  assert.equal(formatTime(3665), '61:05');
});

test('STT limits: speech-to-text daily limits are removed and uncapped', () => {
  assert.equal(LIMITS.sttMinutesPerDay, Infinity);
});

test('STT parsing: parseSarvamSttResult normalizes words and sentence boundaries', () => {
  const result = parseSarvamSttResult(
    {
      transcript: 'First sentence. Second sentence with several words here!',
      language_code: 'hi-IN',
      timestamps: {
        words: [
          'First',
          'sentence.',
          'Second',
          'sentence',
          'with',
          'several',
          'words',
          'here!',
        ],
        start_time_seconds: [0.0, 0.5, 1.2, 1.6, 2.0, 2.3, 2.6, 3.0],
        end_time_seconds: [0.4, 1.0, 1.5, 1.9, 2.2, 2.5, 2.9, 3.4],
      },
    },
    'hi-IN',
  );

  assert.equal(result.detectedLang, 'hi-IN');
  assert.equal(result.segments.length, 2);
  assert.equal(result.segments[0].text, 'First sentence.');
  assert.equal(result.segments[0].startMs, 0);
  assert.equal(result.segments[0].endMs, 1000);
  assert.equal(result.segments[1].text, 'Second sentence with several words here!');
  assert.equal(result.segments[1].startMs, 1200);
  assert.equal(result.segments[1].endMs, 3400);
});

test('STT parsing: fallback to single segment if no timestamps', () => {
  const result = parseSarvamSttResult(
    {
      transcript: 'Direct transcript without word timestamps',
      language_code: 'en-IN',
    },
    'auto',
  );

  assert.equal(result.detectedLang, 'en-IN');
  assert.equal(result.segments.length, 1);
  assert.equal(result.segments[0].text, 'Direct transcript without word timestamps');
});
