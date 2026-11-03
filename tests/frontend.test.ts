/**
 * Frontend unit & integration tests (PRD Section 5 & 12).
 * Run with: node --loader ./scripts/loader.mjs --experimental-strip-types tests/frontend.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMailtoUrl, buildGmailUrl } from '../src/lib/mailto.ts';
import { computeWordDiff } from '../src/lib/diff.ts';
import { t } from '../src/lib/i18n.ts';
import { getDocType, docTypes, categories } from '../src/config/doctypes.ts';
import { getTone, tones } from '../src/config/tones.ts';
import { getLanguage, languages } from '../src/config/languages.ts';
import { useMunshiStore } from '../src/store/useMunshiStore.ts';
import type { Draft } from '../src/contracts/index.ts';

test('Mailto builder: creates standard URL when under length limit', async () => {
  const result = await buildMailtoUrl({
    to: 'official@gov.in',
    subject: 'RTI Application',
    body: 'Please provide certified copies.',
  });

  assert.equal(result.type, 'full');
  assert.equal(result.isTruncated, false);
  assert.ok(result.url.includes('mailto:official%40gov.in'));
  assert.ok(result.url.includes('RTI%20Application'));
});

test('Mailto builder: falls back to clipboard when URI exceeds 1900 chars (Indic unicode)', async () => {
  const longIndicBody = 'बिजली का बिल गलत आया है, कृपया सुधार करें। '.repeat(50);
  const result = await buildMailtoUrl({
    to: 'care@torrentpower.com',
    subject: 'Billing Grievance',
    body: longIndicBody,
  });

  assert.equal(result.type, 'clipboard_fallback');
  assert.equal(result.isTruncated, true);
  assert.ok(result.url.length <= 1900);
});

test('Gmail URL builder: properly formats web compose parameters', async () => {
  const result = await buildGmailUrl({
    to: 'recruiter@tech.com',
    subject: 'Internship Application',
    body: 'Hello, please find my application attached.',
  });

  assert.ok(result.url.startsWith('https://mail.google.com/mail/?view=cm&fs=1'));
  assert.ok(result.url.includes('to=recruiter%40tech.com'));
});

test('Diff algorithm: detects word additions, deletions, and unchanged text', () => {
  const oldText = 'I request you to solve this on Tuesday.';
  const newText = 'I request you to urgently solve this on Monday.';

  const diff = computeWordDiff(oldText, newText);
  const added = diff.filter((d) => d.type === 'added').map((d) => d.value.trim());
  const removed = diff.filter((d) => d.type === 'removed').map((d) => d.value.trim());

  assert.ok(added.includes('urgently'));
  assert.ok(added.includes('Monday.'));
  assert.ok(removed.includes('Tuesday.'));
});

test('i18n: retrieves translated messages and performs variable substitution', () => {
  const enTitle = t('app.title', 'en-IN');
  assert.equal(enTitle, 'Munshi');

  const hiTitle = t('app.title', 'hi-IN');
  assert.ok(hiTitle.includes('मुंशी'));

  const withParam = t('document.tone_chip', 'en-IN', { tone: 'Firm' });
  assert.equal(withParam, 'Tone: Firm');
});

test('Config integration: verifies all 6 categories and writing types', () => {
  assert.equal(categories.length, 6);
  assert.ok(docTypes.length >= 15);

  const grievance = getDocType('grievance');
  assert.ok(grievance);
  assert.equal(grievance.grounding, 'strict');
  assert.equal(grievance.layout, 'letter');
  assert.equal(grievance.disclaimer, true);
  assert.equal(grievance.sendable, true);

  const poem = getDocType('poem');
  assert.ok(poem);
  assert.equal(poem.grounding, 'creative');
  assert.equal(poem.layout, 'verse');
  assert.equal(poem.sendable, false);
});

test('Zustand store: manages draft version history, undo, and redo', () => {
  const store = useMunshiStore.getState();
  store.resetNewCase();

  const draft1: Draft = {
    caseId: 'case_1',
    version: 1,
    lang: 'en-IN',
    docType: 'general_email',
    layout: 'email',
    tone: { id: 'formal' },
    blocks: [{ id: 'b1', role: 'body', text: 'Initial draft version', evidenceIds: [], grounding: 'verified' }],
  };

  const draft2: Draft = {
    ...draft1,
    version: 2,
    blocks: [{ id: 'b1', role: 'body', text: 'Edited draft version', evidenceIds: [], grounding: 'verified' }],
  };

  store.setDraft(draft1, true);
  store.setDraft(draft2, true);

  assert.equal(useMunshiStore.getState().draft?.version, 2);

  store.undoDraft();
  assert.equal(useMunshiStore.getState().draft?.version, 1);
  assert.equal(useMunshiStore.getState().draft?.blocks[0].text, 'Initial draft version');

  store.redoDraft();
  assert.equal(useMunshiStore.getState().draft?.version, 2);
  assert.equal(useMunshiStore.getState().draft?.blocks[0].text, 'Edited draft version');
});

test('Zustand store: resets new case while strictly keeping preferences (FE-2)', () => {
  const store = useMunshiStore.getState();
  store.setPrefs({ uiLang: 'hi-IN', dictationLang: 'gu-IN', tone: { id: 'persuasive' } });

  store.setCaseState({
    caseId: 'case_temp',
    docType: 'grievance',
    docTypeSource: 'user',
    params: {},
    inputLang: 'hi-IN',
    segments: [],
    evidence: [],
    docs: [],
    facts: [{ key: 'f1', label: 'L', value: 'V', evidenceIds: [], confidence: 1, status: 'confirmed' }],
    missing: [],
    contacts: [],
    round: 0,
  });

  store.resetNewCase();

  const state = useMunshiStore.getState();
  assert.equal(state.caseState, null);
  assert.equal(state.draft, null);
  // Prefs must be retained!
  assert.equal(state.prefs.uiLang, 'hi-IN');
  assert.equal(state.prefs.dictationLang, 'gu-IN');
  assert.deepEqual(state.prefs.tone, { id: 'persuasive' });
});

test('Zustand store: initial state defaults safely for SSR hydration and marks isHydrated on rehydrate', () => {
  const store = useMunshiStore.getState();
  assert.equal(typeof store.isHydrated, 'boolean');
  store.rehydrate();
  assert.equal(useMunshiStore.getState().isHydrated, true);
});

