# Munshi — Product Requirements Document (Lean Build)

**Version 4.0 · 3 Nov 2026 · Sarvam campus hackathon · Team of two: Backend (BE) and Frontend (FE)**

Version 4.0 widens Munshi from official letters to **any kind of writing**: complaints, RTI requests, emails (internship, job, leave, follow-up and so on), abstracts, poems and more. The user chooses the writing type, the tone, the dictation language and the document language independently. Nothing is hardcoded to a demo: writing types, tones and languages all live in config files, and the UI reads them.

---

## 1. Summary

**Munshi** (मुंशी, "scribe / writing assistant") turns a spoken or typed idea, optionally with a photo of a bill, notice or letter, into a finished piece of writing: a complaint, RTI application, dispute letter, formal application, email, abstract, poem or something the user describes themselves. The user picks **what** to write, **how** it should sound (tone) and **which languages** to speak and write in. Where the piece is an email-style or letter-style document, the user can open a ready-to-send draft in their own mail app, including by saying who it should go to.

**Tagline:** *Boliye, dikhaiye, likhiye. Speak it, show it, write it.*

### The four independent choices

| Choice | What the user decides | Where the options come from |
| --- | --- | --- |
| Writing type | Complaint, RTI, email, abstract, poem, custom and so on, or "let Munshi decide" | `/config/doctypes.ts` |
| Tone | Formal, firm, friendly, poetic and so on, or a tone described in the user's own words | `/config/tones.ts` |
| Dictation language | The language the user speaks or types in (or auto-detect), changeable at any time, even between recordings | `/config/languages.ts` |
| Document language | The language of the final piece, independent of the dictation language, changeable after drafting | `/config/languages.ts` |

The interface language is a fifth, separate setting.

### Guarantees

- Messy speech, typed notes and a photographed document go in; a finished piece of writing in the chosen type, tone and language comes out.
- **Official and factual writing stays traceable.** For types with strict grounding, every sentence is traceable to what the user said or to the document, or it is visibly flagged as unverified. Creative types are allowed to invent wording, but never real identifiers (see section 5.2).
- The app asks only for what is missing, by voice or text, and asks nothing for types that need nothing.
- No email address is ever invented: every address comes from text that was actually uploaded or fetched.
- The app never sends mail. It opens the user's own mail app or Gmail with a prepared draft.

**Sarvam models:** Saaras v3 (speech to text, including language auto-detect), Sarvam Vision (document reading), Sarvam-105B (type detection, extraction, drafting, tone, edits, intent, ranking), Bulbul v3 (spoken questions and read-back), Mayura or Sarvam-Translate (translation).

This is a real application: no demo mode, no sample data, no mock responses, no seeded organisations, addresses or example texts.

---

## 2. What changed from v3

| Area | v3 | v4 |
| --- | --- | --- |
| Scope of writing | Four official types (grievance, RTI, dispute, application) | Six categories with many types, a "let Munshi decide" mode and a **custom** type for anything else; all defined in the registry |
| Choosing a type | Detected only | User picks from a categorised picker, or lets Munshi detect; can change at any time |
| Tone | Not available | Tone picker (config-driven) plus free-text custom tone; changeable after drafting by menu or command |
| Languages | One "letter language" picker, spoken language mostly auto | Separate **dictation language** and **document language** selectors, each changeable at any time; language-change choice of *translate* or *rewrite* |
| Document layout | Letter only | Four layouts: letter, email, prose, verse (print CSS per layout) |
| Grounding | Always strict | Per-type policy: `strict`, `facts`, `creative` |
| Required inputs | Voice plus usually a document | Document upload is expected, optional or hidden depending on type; a one-line topic is enough for creative types |
| Recipient and send | Always shown | Only for types that have a recipient; others offer Copy, PDF and an optional blank email |
| Type-specific options | None | Types declare optional parameters (for example word limit, poem form) and the UI renders them dynamically |
| Commands | Edit, translate, read aloud, export, recipient, send, undo, redo | Adds `SET_TONE` and `SET_DOCTYPE` |
| Requirement count | About 45 | About 55; new items are marked **new** or **changed** |

No v3 feature is removed.

---

## 3. Goals and non-goals

### Goals

- A complete flow for any supported writing type: choose, capture, understand, clarify, draft, adjust tone, edit, translate, read aloud, export PDF, hand off to email where relevant.
- The user can speak in one language and receive the document in another, and change either at any point.
- Any type, tone or language enabled in the config files appears in the UI without code changes.
- Public HTTPS deployment (the browser microphone needs HTTPS), working on phone and laptop.

### Non-goals

- Accounts, login, database, document history.
- WhatsApp or telephony, bulk or scheduled email, sending mail from our servers.
- Legal advice. Legal-style types always carry a "draft, please verify before sending" line.
- Plagiarism checking, publishing, or long-form books. Output length is capped by model limits.
- Demo mode, fixtures, mock servers, or flags that fake any upstream service.

---

## 4. Users and use cases

**Primary user:** a person who speaks a regional language and needs to write something they cannot write confidently: a formal complaint, an email to a company, an application, an abstract or a poem. **Secondary user:** an operator at a Common Service Centre handling many cases one after another.

| ID | Use case | Must handle |
| --- | --- | --- |
| UC1 | Wrong bill: photo plus a rambling complaint in the user's language | Code-mixed speech, OCR, field extraction, and the send popup appearing on its own when the bill carries a contact email |
| UC2 | RTI about a pending public work: spoken question, recipient named by voice | RTI skeleton, required-fact questions, web lookup of the recipient |
| UC3 | Bank dispute with an ambiguous branch location | A clarifying question before any search |
| UC4 | User corrects themselves ("no, not Tuesday, Monday") | Later statement wins, fact flagged as corrected |
| UC5 | Speech and document disagree on a value | Conflict shown to the user to resolve, never silently picked |
| UC6 | Operator starts the next case | One-tap "New case" that clears everything |
| UC7 | **New:** a student asks for an internship email, speaking in Hindi, output in English | Type picked from the Email category; dictation language differs from document language; recipient may come from a voice command |
| UC8 | **New:** a user wants a poem about a topic in Marathi, in a nostalgic tone | Creative type, no questions required, tone from config, verse layout, no recipient |
| UC9 | **New:** a researcher dictates notes and wants an abstract with a word limit | Prose layout, type parameter (word limit), facts-grounded numbers |
| UC10 | **New:** a user says "make it firmer" after seeing the draft | `SET_TONE` command or tone menu regenerates style only; facts and identifiers unchanged |
| UC11 | **New:** a user wants something no type covers (for example a farewell note to a teacher) | Custom type: user describes it, Munshi proposes a structure, user confirms |
| UC12 | **New:** a user dictates in Gujarati, then switches dictation to English for a follow-up answer | Per-recording dictation language; segments keep their own language tags |

---

## 5. Choice model: writing types, tones and languages

### 5.1 Writing types (registry-driven)

The UI shows a categorised picker built from `/config/doctypes.ts`. The first option is always **Let Munshi decide**; the last is always **Something else (describe it)**, which maps to the `custom` type. The table lists what ships in the first release; each row is a registry entry, not a code branch.

| Category | Shipped types | Typical layout | Grounding |
| --- | --- | --- | --- |
| Complaints and grievances | Grievance or complaint, billing dispute, consumer complaint | letter | strict |
| Official requests | RTI application, formal application, certificate or leave request | letter | strict |
| Emails and letters | Internship application, job application with cover letter, leave request, resignation, recommendation request, follow-up or reminder, thank-you note, general email, general letter | email or letter | facts |
| Academic and professional | Abstract, statement of purpose, summary, meeting minutes | prose | facts |
| Creative | Poem, short story, speech or toast, greeting or invitation | verse or prose | creative |
| Custom | Anything the user describes | proposed at runtime | facts |

### 5.2 What a type controls

Each registry entry declares:

```ts
interface DocTypeDef {
  id: DocTypeId;
  category: CategoryId;
  labelKey: string; descriptionKey: string;   // UI text comes from /messages catalogs
  layout: 'letter' | 'email' | 'prose' | 'verse';
  skeleton: BlockRole[];                      // ordered block roles
  requiredFacts: { key: string; labelKey: string; questionKey: string }[];
  extractableFields: { key: string; labelKey: string; hint: string }[];
  documentUpload: 'expected' | 'optional' | 'hidden';
  grounding: 'strict' | 'facts' | 'creative';
  disclaimer: boolean;                        // legal-style types
  hasRecipient: boolean;                      // shows recipient block and lookup
  sendable: boolean;                          // shows the mail hand-off
  allowedTones: ToneId[] | 'all'; defaultTone: ToneId;
  params?: ParamDef[];                        // optional per-type options
}
interface ParamDef {
  key: string; labelKey: string;
  kind: 'number' | 'select' | 'text' | 'toggle';
  options?: { value: string; labelKey: string }[]; min?: number; max?: number;
}
```

**Grounding policies**

| Policy | Rule |
| --- | --- |
| `strict` | Every block must cite evidence. Every number, identifier and date must match a fact or evidence snippet, or the block is flagged `unverified`. |
| `facts` | Wording is free, but every number, identifier, name and date that the user supplied must be kept exactly, and any number, identifier or date that appears in the text but not in the user's input is flagged `unverified`. |
| `creative` | Invented wording, imagery and characters are allowed and not flagged. Real identifiers (email addresses, phone numbers, account or reference numbers, real organisations the user did not name) must not be invented; the check still flags them. |

The disclaimer applies only where `disclaimer: true`. The custom type inherits `facts` grounding and no disclaimer unless the user's description looks legal-style, in which case the server adds it.

### 5.3 Tones (config-driven)

`/config/tones.ts` holds tone entries: `id`, `labelKey`, English `guidance` text for the prompt, and which categories it applies to. A type can narrow the list through `allowedTones`. The tone picker shows only tones allowed for the chosen type, plus **Describe your own tone** (free text, at most 120 characters, treated as untrusted text inside prompts).

| Tone (first release) | Applies to |
| --- | --- |
| Formal, Polite, Professional, Neutral | all non-creative categories |
| Firm, Assertive, Urgent | complaints, official requests, emails and letters |
| Empathetic, Appreciative, Apologetic | emails and letters, complaints, creative |
| Friendly, Warm | emails and letters, creative |
| Persuasive | emails and letters, academic, creative |
| Poetic, Humorous, Inspirational, Reflective | creative, and emails and letters where the type allows |

Tone changes **style only**: word choice, politeness register (for example the formal and informal address forms in Hindi, Marathi and Gujarati), sentence length and openings. Facts, identifiers, amounts and dates never change. A tone change regenerates the body blocks and leaves locked blocks untouched.

### 5.4 Languages: three independent settings

| Setting | Used by | Default | Changeable |
| --- | --- | --- | --- |
| UI language | Labels, buttons, messages | Browser language if enabled, else English | Any time |
| Dictation language | Speech to text and typed input hints; also the language of follow-up questions and answers | Auto-detect | Any time, including between recordings; each `Segment` keeps its own `lang` |
| Document language | The final piece, read-back and PDF | The document's language if enabled, otherwise the dictation language | Any time after drafting |

All three lists come from `/config/languages.ts`. A language appears in a picker only if the model needed for that use supports it (STT for dictation, LLM and translate for document language, TTS for read-back). Changing the **document language** after a draft exists offers two buttons: **Translate this draft** (keeps wording, blocks and evidence) and **Rewrite in this language** (regenerates from the facts, which reads more naturally and is the default for creative types). Facts are never retranslated; names, numbers and addresses stay as they are.

---

## 6. Requirements

**Priority:** P0 = required for release. P1 = ships in the first release. Each requirement has exactly one owner. **New** and **Changed** mark differences from v3.

### 6.1 Backend (BE)

| ID | P | Requirement |
| --- | --- | --- |
| BE-1 | P0 | **Sarvam wrappers.** Typed wrappers in `/server/sarvam` for stt, vision, llm, tts, translate. Timeouts, retry with backoff on 429/5xx, errors normalised to the shared error envelope. Routes never call Sarvam HTTP APIs directly; search goes through `/server/search`. |
| BE-2 | P0 | **Capability probe.** `/scripts/probe-sarvam.ts` calls every Sarvam API once per candidate language and prints which models support which languages, TTS voices and STT modes. Results are recorded by hand in `/config/languages.ts`. Also confirm REST limits (STT length, TTS length, Vision pages) in the docs. |
| BE-3 | P0 | **Gate, limits and validation (one middleware).** Every `/api` route except `/api/health` checks `X-Access-Code` (constant-time compare), applies a per-IP rate limit and daily per-IP caps for Vision pages, STT minutes and lookups (shared Redis store such as Upstash or Vercel KV), and validates the body with Zod, including that `docTypeId`, `toneId`, `dictationLang` and `letterLang` exist in config. Request, file and audio size caps are enforced here, and file type is checked by magic bytes. A provider-side spend limit is set. |
| BE-4 | P0 | **Errors and logging.** One error envelope (section 8) with stable code, message, `retryable` and `requestId`. Structured JSON logs with `requestId`, route, latency and status. Logs never contain transcript, document text, drafts, custom briefs, addresses or audio. |
| BE-5 | P0 | **LLM safety.** LLM JSON is schema-validated; on failure, repair and retry once, then return `LLM_INVALID_OUTPUT` (command routing falls back to `UNKNOWN`). Transcripts, OCR text, fetched pages, custom briefs and custom tone text are untrusted data: delimited in prompts, no LLM tools, output validated. |
| BE-6 | P0 | **Speech to text (changed).** `POST /api/stt` takes audio and a dictation language code from config, or `auto`, per request, so the user can change dictation language between recordings. Uses the STT mode configured for that language (including code-mix), chunks long audio if the REST limit requires it, and returns timestamped `Segment[]` exactly as transcribed, each tagged with its detected or chosen language. |
| BE-7 | P0 | **Document reading.** `POST /api/vision` validates the file (PDF, PNG, JPG; at most 10 pages) and starts a Sarvam Vision job, returning `jobId`. `GET /api/vision/status` returns state, markdown per page, extracted fields and contacts when done. The server stores nothing; the client polls. |
| BE-8 | P0 | **Fields and contacts from documents (changed).** Extract the fields declared by the chosen type's `extractableFields` (or a generic set when the type is `auto` or `custom`) as `Fact` objects; each fact's evidence snippet must appear verbatim (whitespace-normalised) in the source text or the fact is dropped. Run an email regex over the Vision output (also phones and portal URLs), normalise OCR confusions (`0`/`O`, `l`/`1`, spaces around `@` and `.`), and emit `Contact` objects with origin `document`, setting `needsConfirmation` on low-confidence matches. |
| BE-9 | P0 | **Understand (changed).** `POST /api/understand` takes `docTypeId` (a registry id, `auto` or `custom`), optional `customBrief`, `params`, transcript segments (any mix of languages), document text, and optionally the previous `CaseState` plus `answers`. With `auto`, it classifies the input into a registry type, returns `docTypeSource: 'auto'` and a confidence, and the user can override. It returns facts with evidence, missing facts (required keys from the registry plus model-suggested gaps; at most 2 questions per round and 2 rounds; creative types have no required facts, so they ask only when the input is too thin to write from), and handles self-correction (later statement wins, `status: 'corrected'`, `previousValue` kept) and conflicts (`status: 'conflict'` with both values in `alternatives`). Works on typed text alone, on a one-line topic for creative types, and with no document at all. |
| BE-10 | P0 | **Writing-type registry (changed).** `/config/doctypes.ts` defines each type as in section 5.2 and ships the entries listed in section 5.1. Adding a type, category, parameter or tone means editing config files only; no route or component contains type-specific branches except through registry fields. |
| BE-11 | P0 | **Custom type (new).** For `custom`, `/api/understand` asks Sarvam-105B to propose a structure from the user's `customBrief`: a label, a layout and an ordered `skeleton` made only of allowed block roles, plus any required facts. The proposal is schema-validated against the allowed roles and returned inside `CaseState.customDef` so the user can confirm or edit it before drafting. The proposal never grants `sendable`, `hasRecipient` or disclaimer exemptions on its own; those are derived from layout and keyword rules in config. |
| BE-12 | P0 | **Draft (changed).** `POST /api/draft` takes a `CaseState`, `letterLang`, `toneId` (or `customTone`), `params` and the client date, and streams blocks as they are generated; each block has a role, text and `evidenceIds`. Block roles follow the type's skeleton and layout. It builds subject and enclosures only for letter and email layouts. With an optional `instruction` and the current draft, it performs an edit; with `toneChange`, it regenerates only body blocks in the new tone; either way facts stay immutable and a new version is returned with the changed block ids. `mode: 'rewrite'` regenerates in a new document language from facts. |
| BE-13 | P0 | **Grounding and disclaimer (changed).** After generation, apply the type's grounding policy from section 5.2. Set `grounding: 'verified' \| 'unverified'` (flagged, never dropped). For types with `disclaimer: true`, add the disclaimer block server-side marked `locked`; edits and tone changes cannot remove it. |
| BE-14 | P0 | **Command router (changed).** `POST /api/command` takes text, the draft and the case, and returns an intent and payload: `EDIT`, `TRANSLATE`, `SET_TONE` (tone id or custom text), `SET_DOCTYPE`, `READ_ALOUD`, `EXPORT`, `SET_RECIPIENT` (org, dept, location), `SEND`, `UNDO`, `REDO`, `UNKNOWN`. Tone ids in the prompt come from config. |
| BE-15 | P1 | **Translate.** `POST /api/translate` translates block by block using Mayura or Sarvam-Translate (only languages the model supports per config), keeps `evidenceIds` and block alignment, and flags a block `unverified` if identifiers, amounts or dates did not survive. For verse layout it keeps stanza breaks. The disclaimer is translated, never removed. |
| BE-16 | P1 | **Text to speech.** `POST /api/tts` takes text and language, picks the voice from config, chunks to the Bulbul limit, and returns audio chunks for sequential playback. Used for follow-up questions (in the dictation language) and read-back (in the document language). |
| BE-17 | P1 | **Recipient lookup.** `POST /api/recipient` implements the pipeline in section 9: ambiguity check (returns `needs_clarification` with a question instead of guessing), web search, SSRF-safe fetch (public IPs only, checked after DNS and each redirect; http(s) only; capped redirects, size and time; text content only), regex extraction, official-domain ranking, MX verification, up to 3 candidates with source URL and snippet, or `not_found` with the official complaint portal link if one was found. Only called for types with `hasRecipient: true`. |
| BE-18 | P0 | **Tone engine (new).** `/server/prompts` builds the style instruction from `/config/tones.ts` guidance, the document language and, for custom tones, the sanitised free text. It adds language-specific register rules (for example formal address in Hindi, Marathi, Gujarati) from `/config/languages.ts`, and refuses tones not allowed for the type with `VALIDATION_FAILED`. |

### 6.2 Frontend (FE)

| ID | P | Requirement |
| --- | --- | --- |
| FE-1 | P0 | **Shell and foundation (changed).** Two-panel layout (capture left, document right; stacked or tabbed on phones), a persistent **setup bar** above both panels (FE-22), access-code screen (code kept in `sessionStorage`, re-prompt on `ACCESS_DENIED`), one typed API client generated from `/contracts` (adds the access header and request id, supports abort and streaming over `fetch`; no component calls `fetch` directly). |
| FE-2 | P0 | **Store, sessions and preferences (changed).** Zustand store (`case`, `draft`, `contacts`, `focusedEvidenceId`, `prefs`, UI state) mirrored to `sessionStorage` with a schema version, cleared when the tab closes; audio blobs and files are not persisted. `prefs` (UI language, dictation language, document language, last tone, last writing type) are mirrored to `localStorage` because they hold no personal content, so the user does not set them again next visit. A "New case" button (with confirmation) clears case data and keeps `prefs`. |
| FE-3 | P0 | **Error, loading and empty states.** Every async flow shows a progress message while loading and a plain error with Retry on failure, keeping everything entered so far. Error behaviour is chosen per `ApiError.code`. |
| FE-4 | P0 | **UI language (changed).** UI strings come from `/messages/{lang}.json` with English fallback. This includes every writing-type label and description, category name, tone label, and type-parameter label (all referenced by key from config). A small script generates each catalog once from the English file using the translate wrapper; language lists everywhere read from `/config/languages.ts`. |
| FE-5 | P0 | **Voice recorder with typed fallback (changed).** `MediaRecorder` with tap to start and stop, permission-denied guidance, browser format negotiation (webm/opus vs mp4 on Safari), level meter, max duration, upload to `/api/stt` with the **current dictation language** (or `auto`). The dictation language chip is visible on the recorder and changeable before every recording. Every voice input in the app (dictation, follow-up answers, commands) has a typed equivalent. |
| FE-6 | P0 | **Raw transcript (changed).** Timestamped segments shown exactly as transcribed, messy parts included, each with a small language tag when more than one language appears. |
| FE-7 | P0 | **Document upload and Vision (changed).** Camera, file picker and drag-and-drop; PDF, PNG, JPG; multiple files; at most 10 pages. The upload zone follows the type's `documentUpload`: prominent when `expected`, collapsed under "Add a document" when `optional`, absent when `hidden`. Client-side validation and image downscaling. Upload starts immediately, in parallel with speaking; status is polled with backoff with per-file progress, cancel and retry. A file already read is never re-submitted. |
| FE-8 | P0 | **Field chips and contact confirmation.** Key fields declared by the type's `extractableFields` appear as chips that light up as found. Addresses read from documents are shown for confirmation and are editable, especially those flagged `needsConfirmation`. |
| FE-9 | P0 | **Understanding review (changed).** Shows the writing type (changeable from the categorised picker, with an "Munshi chose this" badge and confidence when auto-detected), the facts list (editable, each linked to evidence), missing facts, and conflict resolution (both values with sources; the user picks one or types a third). Changing the type re-runs `/api/understand` on the same inputs. |
| FE-10 | P1 | **Follow-up card.** For each missing fact (at most 2 per round) show the question, play it with Bulbul in the dictation language, accept a voice or typed answer, send it with `answers` to `/api/understand`, and mark corrected facts with a "corrected" label. Not shown for types with no missing facts. |
| FE-11 | P1 | **Evidence highlighting.** When `focusedEvidenceId` changes, scroll to and highlight the matching transcript segment or document snippet. |
| FE-12 | P0 | **Live draft (changed).** The draft stream renders blocks progressively with skeleton loaders in the layout of the chosen type: letter (sender, date, recipient, subject, salutation, body, closing, enclosures, disclaimer), email (subject line and body in an email card), prose (title, headings, paragraphs) or verse (title, stanzas with preserved line breaks). Skeletons come from the type's `skeleton`, not from hardcoded layouts per type. |
| FE-13 | P1 | **Provenance and grounding (changed).** For `strict` and `facts` types, each block shows speech or document chips; clicking one sets `focusedEvidenceId`. Blocks marked `unverified` show a visible badge. For `creative` types, chips are hidden and only identifier warnings appear. |
| FE-14 | P0 | **Command bar (changed).** One mic or text box on the document panel; dispatches the returned intent (edit, translate, set tone, change type, read aloud, export, set recipient, send, undo, redo). `UNKNOWN` shows a helpful message. |
| FE-15 | P1 | **Edit review and versions.** After an edit or tone change, show a word-level diff highlight. Keep a client-side version list with undo and redo. |
| FE-16 | P1 | **Language toggle.** Side-by-side original and translated document; only languages the translation model supports (per config) are offered. |
| FE-17 | P1 | **Read-back.** Play TTS chunks sequentially in the document language with pause, resume and stop, highlighting the block being read. |
| FE-18 | P0 | **PDF export (changed).** Browser print-to-PDF with print CSS chosen by `layout` (letter margins, email card, prose columns, centred verse). Self-hosted Noto fonts chosen by the `script` field in `/config/languages.ts` (jsPDF is not used because it breaks on Indic text). |
| FE-19 | P1 | **Send modal and mail hand-off (changed).** Available only when the type is `sendable`. Opens when a draft is ready and at least one contact exists, or on `SEND` or manual open. Shows editable, validated recipient; auto subject; body; and a source badge (your document, official site with link, third-party site with warning). Buttons: Open in my mail app, Open in Gmail, Copy text, Download PDF, plus a one-line hint to attach the PDF. `/lib/mailto` builds the `mailto:` link with the full text as body when it fits (safe working limit about 2,000 characters for the whole link; Hindi and Gujarati take about nine link characters per letter once encoded, so test on the mail apps you use). When it does not fit, copy the text to the clipboard, open the draft with a short body and show "Text copied, paste it into the email". Gmail compose links follow the same logic. For types that are not `sendable` (poem, abstract and so on) the same menu offers only Copy, Download PDF and "Email this to someone" with a blank recipient. |
| FE-20 | P1 | **Recipient by command, and fallback.** Only for types with `hasRecipient`. For `SET_RECIPIENT`, call `/api/recipient`, show up to 3 candidates with source link, snippet and trust badge, ask the clarifying question (voice or typed) when `needs_clarification` comes back, and when nothing is found let the user type or paste an address and show the portal link if present. |
| FE-21 | P1 | **Responsive and accessible basics.** Works on phone (camera upload) and laptop; labelled controls, keyboard operation, `aria-live` for progress and errors, readable contrast. All pickers are usable with keyboard and screen readers. |
| FE-22 | P0 | **Setup bar (new).** One compact bar with four controls: **Writing type** (categorised picker with search and "Let Munshi decide" and "Something else"), **Tone** (list filtered by `allowedTones`, with "Describe your own"), **I will speak in** (dictation language, with Auto), **Write it in** (document language, with "Same as I speak"). Each shows its current value and works before, during and after a case. The type and tone lists render from config and update when config changes. |
| FE-23 | P1 | **Type options (new).** If the chosen type declares `params`, show them as a small dynamic form built from `ParamDef` (number, select, text, toggle) beside the setup bar. Values go to `/api/understand` and `/api/draft`. Changing a value after drafting offers "Regenerate". |
| FE-24 | P0 | **Tone control after drafting (new).** A tone chip on the document panel opens the tone list; picking one calls `/api/draft` with `toneChange` and shows the diff (FE-15). Facts, locked blocks and the disclaimer stay the same. A voice or typed command such as "make it firmer" does the same through `SET_TONE`. |
| FE-25 | P0 | **Document language change (new).** Changing "Write it in" after a draft exists opens a two-button dialog: **Translate this draft** or **Rewrite in this language** (default for creative types). The old version is kept in the version list. Changing the dictation language never alters an existing draft. |
| FE-26 | P1 | **Custom type builder (new).** Choosing "Something else" opens a one-box description field (voice or typed). After `/api/understand` returns `customDef`, show the proposed structure as an editable list of blocks (rename, reorder, remove, add from allowed roles) and a Confirm button before any draft is generated. |

**Stretch (only after release):** Web Share button passing the PDF and text to the mail app on supporting phones, with fallback to the existing buttons.

### 6.3 Non-functional requirements

| ID | P | Requirement |
| --- | --- | --- |
| NFR-1 | P0 | **Keys server-side only.** All Sarvam and search credentials live in server environment variables. |
| NFR-2 | P0 | **No persistence of personal data (changed).** No database. Case data lives in the browser tab and request bodies; the server keeps nothing per user. The only browser-local persistence beyond the tab is `prefs` (languages, tone, last type), which holds no personal content. Rate-limit counters hold no personal data. |
| NFR-3 | P0 | **Config, nothing hardcoded (changed).** Three config files drive everything: `/config/languages.ts` (code, label, script and font family, model support for STT, TTS, translate and LLM, TTS voice, STT mode, register rules), `/config/doctypes.ts` (section 5.2) and `/config/tones.ts` (section 5.3). UI lists, prompts and routes read from them; no component or route may branch on a specific type, tone or language id. Adding a type, tone or language means editing config and, for UI text, regenerating message catalogs. |
| NFR-4 | P0 | **No mock or sample content.** No sample organisations, emails, amounts, sentences, poems, example prompts with fake names, demo flags or fixture responses in components, prompts or routes. Placeholders are generic instructions only (for example "Describe what you want to write"). Everything shown comes from live input or live upstream calls. |
| NFR-5 | P0 | **Privacy.** Voice, photos, drafts, custom briefs and addresses are processed only for the session. Logs hold no personal content. |
| NFR-6 | P0 | **Disclaimer.** Present on every type with `disclaimer: true`, on screen and in the PDF (BE-13). |
| NFR-7 | P1 | **Speed and resilience.** First draft block visible within about 8 seconds of the end of speech; every spinner has a progress message; upstream timeouts and retries are bounded; partial results (for example Vision done but STT failed) are kept so the user can continue. |
| NFR-8 | P1 | **Content safety (new).** Creative and custom types follow Sarvam's usage policy; the server returns `VALIDATION_FAILED` with a plain message when a request is refused upstream, and the UI keeps the user's input so they can rephrase. |

---

## 7. UI changes

The screen keeps the two-panel layout from v3 and adds one setup bar. The wireframe shows laptop layout; on phones the bar scrolls horizontally and the panels become two tabs.

```
+------------------------------------------------------------------------------+
| Munshi        [ Writing type v ] [ Tone v ] [ I speak in v ] [ Write it in v ] |
|             [ Type options (only if the type has them) ]       [ New case ]  |
+--------------------------------+---------------------------------------------+
|  CAPTURE                       |  DOCUMENT                                   |
|  - Mic button, level meter,    |  - Tone chip, language chip, version list   |
|    dictation language chip     |  - Live draft in the layout of the type     |
|  - Typed text box              |  - Provenance chips and unverified badges   |
|  - Upload zone (if the type    |  - Command bar (mic or text)                |
|    expects or allows one)      |  - Export PDF, Send or Copy menu            |
|  - Raw transcript              |                                             |
|  - Field chips and contacts    |                                             |
|  - Understanding review,       |                                             |
|    follow-up card              |                                             |
+--------------------------------+---------------------------------------------+
```

**Screen behaviour**

| Element | Behaviour |
| --- | --- |
| Writing type picker | Opens a list grouped by category (section 5.1) with search. "Let Munshi decide" is first, "Something else" last. Each entry shows a short description from the message catalog. After detection, the bar shows the chosen type with an "Munshi chose this" badge. |
| Tone picker | Shows only tones allowed for the type; defaults to the type's `defaultTone`; "Describe your own" opens a short text field. |
| "I speak in" | Lists dictation-capable languages plus Auto. Changes apply to the next recording; earlier segments keep their tags. |
| "Write it in" | Lists document-capable languages plus "Same as I speak". Before a draft it sets the target; after a draft it opens the FE-25 dialog. |
| Type options | Appears only when the type declares `params`, for example a word limit or a poem form. Fields are generated from `ParamDef`. |
| Capture panel | Upload zone, field chips and follow-up card appear or hide according to the type. Creative types go from input straight to draft. |
| Document panel | Layout follows the type: letter with address blocks, email card, prose, or verse. Send menu shows or hides by `sendable`. |
| Custom type | The builder from FE-26 appears in place of the draft until the user confirms the structure. |

---

## 8. Architecture and contract

**Stack:** Next.js (App Router), TypeScript, Tailwind, Zustand, Zod, Redis-compatible store for rate limits, deployed to Vercel. Route handlers run on the Node runtime (needed for DNS and MX lookups) with `maxDuration` set per route. Every request carries the state it needs; the server is stateless. Vision is an async job polled by the client. Draft streaming uses a `fetch` readable stream (POST).

### Repository layout and ownership

| Path | Owner | Notes |
| --- | --- | --- |
| `/contracts` | BE writes, FE reviews | Zod schemas and inferred types. Frozen after M0; additive changes only. |
| `/config/languages.ts`, `/config/doctypes.ts`, `/config/tones.ts` | BE writes, FE reads | Contain no secrets, so the client can import them. |
| `/app/api/**`, `/server/**` (`sarvam`, `search`, `prompts`, shared helpers), `/scripts` | BE | Thin route handlers; all server logic and prompts. |
| `/app` pages, `/components`, `/store`, `/lib` (`api-client`, `mailto`, `audio`, `diff`), `/messages` | FE | All UI and client-side logic. |
| `/local-inputs` | Both, git-ignored | Each developer's own real recordings and documents. Never committed. |

### Contract

```ts
type Lang = string;       // BCP-47 code such as 'hi-IN'; valid values only from /config/languages.ts
type DocTypeId = string;  // key of /config/doctypes.ts, or 'auto' (request only) or 'custom'
type ToneId = string;     // key of /config/tones.ts
type BlockRole = 'sender' | 'date' | 'recipient' | 'subject' | 'salutation' | 'title' | 'heading'
               | 'body' | 'stanza' | 'closing' | 'enclosures' | 'disclaimer';
type ToneChoice = { id: ToneId } | { custom: string };   // custom: at most 120 characters

interface Segment  { id: string; startMs: number; endMs: number; text: string; lang: Lang }
interface Evidence { id: string; kind: 'speech' | 'document'; segmentId?: string; docId?: string; page?: number; snippet: string }

interface Fact {
  key: string; label: string; value: string;
  evidenceIds: string[]; confidence: number;
  status: 'extracted' | 'corrected' | 'confirmed' | 'conflict';
  previousValue?: string;
  alternatives?: { value: string; evidenceIds: string[] }[];   // when status === 'conflict'
}
interface MissingFact { key: string; label: string; question: string; required: boolean }

interface Contact {
  id: string; email: string; label: string;
  origin: 'document' | 'web';
  trust: 'from_user_doc' | 'official' | 'third_party';
  sourceUrl?: string; snippet: string;
  mxOk?: boolean; needsConfirmation?: boolean;
}
interface RecipientHint { raw: string; org: string; dept?: string; location?: string }

// Runtime-proposed structure for the 'custom' type; validated against allowed roles
interface CustomDef {
  label: string; layout: 'letter' | 'email' | 'prose' | 'verse';
  skeleton: BlockRole[]; requiredFacts: { key: string; label: string; question: string }[];
  sendable: boolean; hasRecipient: boolean;
}

interface Prefs {                  // browser-local, no personal content
  uiLang: Lang; dictationLang: Lang | 'auto'; letterLang: Lang | 'same';
  tone?: ToneChoice; lastDocType?: DocTypeId;
}

interface CaseState {
  caseId: string;
  docType: DocTypeId; docTypeSource: 'user' | 'auto'; docTypeConfidence?: number;
  customBrief?: string; customDef?: CustomDef;
  params: Record<string, string | number | boolean>;     // values for the type's ParamDefs
  inputLang: Lang;                                       // main dictation language seen
  segments: Segment[]; evidence: Evidence[];
  docs: { id: string; name: string; pages: number; markdown: string }[];
  facts: Fact[]; missing: MissingFact[];
  contacts: Contact[];              // origin 'document' only, from the backend
  recipientHint?: RecipientHint;    // set when the user already named a recipient
  round: number;                    // follow-up rounds used (max 2)
}

interface DraftBlock {
  id: string; role: BlockRole;
  text: string; evidenceIds: string[];
  grounding: 'verified' | 'unverified';
  locked?: boolean;                 // disclaimer cannot be edited away
}
interface Draft {
  caseId: string; version: number; lang: Lang; docType: DocTypeId;
  layout: 'letter' | 'email' | 'prose' | 'verse'; tone: ToneChoice; blocks: DraftBlock[];
}
// Mail subject = text of the block with role 'subject'.

type Intent = 'EDIT' | 'TRANSLATE' | 'SET_TONE' | 'SET_DOCTYPE' | 'READ_ALOUD' | 'EXPORT'
            | 'SET_RECIPIENT' | 'SEND' | 'UNDO' | 'REDO' | 'UNKNOWN';
type CommandResult =
  | { intent: 'EDIT'; instruction: string }
  | { intent: 'TRANSLATE'; targetLang: Lang }
  | { intent: 'SET_TONE'; tone: ToneChoice }
  | { intent: 'SET_DOCTYPE'; docType: DocTypeId }
  | { intent: 'SET_RECIPIENT'; hint: RecipientHint }
  | { intent: 'READ_ALOUD' | 'EXPORT' | 'SEND' | 'UNDO' | 'REDO' | 'UNKNOWN' };

interface LookupResult {
  status: 'ok' | 'needs_clarification' | 'not_found';
  candidates: Contact[];            // up to 3, ranked
  portalUrl?: string;
  clarification?: { question: string; options?: string[] };
}

interface ApiError {
  code: 'ACCESS_DENIED' | 'RATE_LIMITED' | 'VALIDATION_FAILED' | 'UNSUPPORTED_LANGUAGE'
      | 'FILE_UNSUPPORTED' | 'UPSTREAM_TIMEOUT' | 'UPSTREAM_ERROR' | 'LLM_INVALID_OUTPUT' | 'INTERNAL';
  message: string; retryable: boolean; requestId: string;
}

// Draft stream frames
type DraftEvent =
  | { type: 'block'; block: DraftBlock }
  | { type: 'done'; draft: Draft; changedBlockIds?: string[] }
  | { type: 'error'; error: ApiError };
```

**Change rule:** after the M0 freeze, contract changes are additive only (new optional fields), announced in chat and merged by a PR the other developer approves within 10 minutes.

### API

All routes are BE-owned, send `X-Access-Code` and `X-Request-Id`, and return the `ApiError` envelope on failure. There is no email route; the browser builds the mail link. There is no config route either: the three config files are imported by the client directly.

| Route | In | Out |
| --- | --- | --- |
| `GET /api/health` | none | `{ ok }` (no access code needed) |
| `POST /api/stt` | audio, `lang` (a dictation language or `auto`) | `{ segments }` |
| `POST /api/vision` | file | `{ jobId }` |
| `GET /api/vision/status?jobId=` | none | `{ state, progress, pages?, markdown?, fields?, contacts? }` |
| `POST /api/understand` | `{ docTypeId, customBrief?, params?, segments, docs, inputLang, previousCase?, answers? }` | `CaseState` |
| `POST /api/draft` | `{ case, letterLang, tone, params, today, mode?: 'rewrite', instruction?, toneChange?, currentDraft? }` | stream of `DraftEvent` |
| `POST /api/command` | `{ text, draft, case }` | `CommandResult` |
| `POST /api/translate` | `{ draft, targetLang }` | `Draft` |
| `POST /api/tts` | `{ text, lang }` | audio chunk(s) |
| `POST /api/recipient` | `{ hint, clarificationAnswer? }` | `LookupResult` |

---

## 9. Recipient lookup and mail hand-off

This section applies only to types with `hasRecipient: true` (and, for the hand-off, `sendable: true`). Poems, abstracts and similar types skip it.

**Entry points:** (1) the draft is ready and the backend found an email in the uploaded document; (2) the user names a recipient by voice or text; (3) the user opens Send manually.

**Lookup pipeline (BE-17):**

1. The command router returns a `RecipientHint`. If org or location is ambiguous, return `needs_clarification` with one question and search only after the answer.
2. Search through an API with a free tier (Tavily, Serper or Brave; use whichever key you can get fastest). Query patterns: `{org} {dept} customer care email`, `{org} grievance email`, `{org} {location} branch email`; for emails to a company or institution (for example an internship application), `{org} careers email` or `{org} internship contact`.
3. Fetch the top results through the SSRF-safe fetcher and extract addresses with a regex from the page text.
4. Rank: prefer official domains (`.gov.in`, `.nic.in`, `.ac.in`, `.edu`, the organisation's own site) over directories. Set `trust` to `official` or `third_party`.
5. Verify each candidate domain has a mail server (MX lookup) and set `mxOk`.
6. Return up to 3 `Contact` objects with source URL and snippet. Sarvam-105B may help rank or label, within rule R1.
7. If nothing is found, return `not_found` with the portal link if one was found.

**Hard rules**

- **R1:** an address may only come from text actually fetched or uploaded (regex match). The LLM never generates or completes an address, in any writing type, including creative ones.
- **R2:** the app never sends mail. It opens the user's own mail app or Gmail with a draft; the user presses Send there.
- **R3:** show the source link for any web-found address and warn when the source is third-party.
- **R4:** OCR-read addresses are shown for confirmation and are editable.
- **R5:** ambiguity leads to a question, never a guess.

**Mail hand-off:** no SMTP, no sender account, no email route, and the app never collects the user's own address. If no mail handler is configured on a device, Open in Gmail and Copy text still work; Download PDF is always shown because a mail link cannot attach files.

---

## 10. Work split

**Why backend and frontend:** BE owns everything that runs on the server (Sarvam calls, search, prompts, tone engine, validation, security, contracts, config). FE owns everything that runs in the browser (UI, setup bar, state, audio and camera, print layouts, mail links). The only things passing between them are `/contracts`, the three config files and the HTTP API in section 8.

**Working without mock data:** FE builds against the real backend. To keep FE unblocked without fixtures:

1. BE ships routes in the order in section 11, simplest end-to-end path first (typed text to `CaseState`).
2. FE starts with what needs no backend: shell, setup bar driven by config, access screen, store and preferences, recorder and upload UI, print layouts and fonts, `/lib/mailto`, `/lib/diff`, command bar UI, UI string catalogs.
3. The typed client is generated from `/contracts`, so FE codes against the real types from day one.
4. `npm run dev` and a shared Vercel preview both run the real backend with real keys. There is no mock server and no `DEMO` or `MOCK` flag.

**Working rules**

- Trunk-based: small PRs to main, rebase often, edit only your own folders.
- Anything in `/contracts`, `/config` or the other developer's folders needs a chat message first and a PR the other developer approves within 10 minutes.
- BE announces in chat whenever a route becomes usable, with the route name and a one-line example of real use.
- After every merge, run the full flow once with real inputs from `/local-inputs`, using at least one official type and one creative type.

---

## 11. Milestones

Ordered by dependency, not clock time. Each has an exit criterion.

| # | Milestone | BE | FE | Exit criterion |
| --- | --- | --- | --- | --- |
| M0 | **Foundation** (together) | Repo, Vercel, env vars, Redis. `/contracts`. Sarvam wrappers. Middleware (gate, limits, validation), error envelope, logging. Probe run; `languages.ts`, `doctypes.ts` and `tones.ts` written. | Shell with two panels and setup bar, store and prefs skeleton, typed client generator, access screen, UI string catalog generator. | Contract frozen. Public HTTPS URL live. `/api/health` reached through the client. Setup bar lists types, tones and languages from config. |
| M1 | **Capture and understand** | `/api/understand` on typed text first (including `auto` detection and a topic-only creative case), then `/api/stt` with per-request dictation language, then `/api/vision` with field and contact extraction. | Typed input, recorder with dictation language chip, transcript, upload zone that follows the type, upload and polling, chips, contact confirmation, understanding review with type switching. | A spoken input in one language and a photographed document produce a `CaseState` with chips and contacts; a topic-only poem request produces a `CaseState` with no questions. |
| M2 | **Draft and export** | `/api/draft` with streaming, tone engine, layouts and per-type grounding; disclaimer; `/api/command`. | Document language picker, live assembly by layout, command bar, tone picker, PDF export with correct fonts for each layout. | A real official case and a real creative case each produce a document in the chosen tone and language that exports to PDF with correct Indic rendering. |
| M3 | **Interaction depth** | Follow-ups, self-correction and conflicts in `/api/understand`; edit, tone change and rewrite in `/api/draft`; custom type proposal; `/api/translate`; `/api/tts`. | Follow-up card, conflict UI, diff and versions, language change dialog, tone change after drafting, type options form, custom type builder, language toggle, read-back, provenance and highlighting. | The full voice loop works: ask, answer, edit, change tone, translate or rewrite, read aloud. |
| M4 | **Delivery** | `/api/recipient` with safe fetcher, MX checks and clarification. | Send modal (only for sendable types), mail link builder with clipboard fallback, candidate picker, manual entry, Copy and PDF menu for other types. | From a finished letter or email, a prepared draft opens in the user's mail app or Gmail with the right recipient. |
| M5 | **Hardening** | Tune rate limits, verify spend limit, audit logs, review timeouts, review refusal handling for creative input. | Browser pass, accessibility basics, failure-state review. | Release checklist (section 13) passes. |

---

## 12. Testing

No fixtures, mocks or recorded upstream responses are committed.

1. **Unit tests for pure logic**, with inputs written inline: email regex and OCR normalisation, mailto builder and length logic, diff, grounding token matching for each policy (`strict`, `facts`, `creative`), tone and type validation against config, custom-skeleton role validation, SSRF IP-range checks, schema validation.
2. **One smoke script** (BE) that calls each route in turn with a real recording and document from `/local-inputs` and checks schema conformance and invariants: every fact snippet exists in its source, every address matches a regex hit in fetched text, the disclaimer survives edit, tone change and translate, a tone change leaves facts and identifiers unchanged, and a creative draft contains no invented email address or phone number.
3. **Manual checklist** (both devs) on the combinations that matter: every enabled language as dictation and as document language, at least one cross-language pair, every category, a few tones per category, voice and typed input, laptop and phone, and Chrome plus Safari at minimum. Failure paths are tested by going offline in the browser or running locally with a blank key; the app contains no fault-injection code.

Each developer keeps a personal set of real inputs (utility bills, a notice, a rejection letter, notes for an email and an abstract, topic lines for a poem, and recordings in each enabled language including code-mixed and self-correcting speech) in the git-ignored `/local-inputs`.

---

## 13. Release checklist

All must pass on the deployed HTTPS URL.

- A real case runs end to end (speak, photograph if relevant, clarify, draft, edit, change tone, translate or rewrite, read aloud, export, hand off) in every enabled language.
- At least one case from each category (complaint, official request, email, academic, creative, custom) produces a correctly laid-out document.
- Dictation in one language with output in a different language works for at least two pairs, and changing either setting mid-case behaves as in section 5.4.
- Changing tone after drafting changes style only: facts, numbers and the disclaimer are unchanged.
- A failed Sarvam or search call shows a clear error and Retry, and the flow continues afterwards with prior work intact.
- A refresh mid-case restores the case; closing the tab clears it but keeps language, tone and type preferences.
- The PDF renders every enabled script correctly in each layout.
- Microphone and phone camera flows work.
- The send modal appears from a document email; voice recipient lookup works for at least two organisations; an ambiguous location triggers a question; a third-party source shows its warning; non-sendable types show only Copy and PDF.
- Mail hand-off works on the laptop's default mail handler, Gmail and the phone, including the clipboard fallback for one Hindi and one Gujarati text, and the PDF downloads.
- Every address in every run traces to a regex match; logs contain no personal content.
- Adding a new writing type, tone and language to the config files makes each appear in the UI without code changes.
- A deliberate over-limit run is rejected by the rate limit.

---

## 14. Risks and open questions

| Risk | Mitigation |
| --- | --- |
| Language support differs per model; docs disagree on how many languages Sarvam-105B covers | Probe in M0 (BE-2); UI offers only supported combinations per use (dictation, document, read-back); list lives in config |
| Wrong type auto-detected | User can pick the type first, sees an "Munshi chose this" badge, and can change it; re-run keeps inputs (FE-9) |
| Tone quality varies by language | Per-language register rules in config (BE-18); manual review of each tone in each enabled language during M5 |
| Creative or custom output invents facts or identifiers | Grounding policy per type (section 5.2); identifiers always checked; R1 for addresses |
| Custom type proposes a poor structure | Structure is shown and editable before drafting (FE-26); only allowed block roles accepted (BE-11) |
| Prompt injection through custom brief, custom tone or documents | Treated as untrusted data, delimited, no tools, output validated (BE-5) |
| Registry growth makes the picker long | Categories, search and "Let Munshi decide" (FE-22) |
| LLM JSON malformed | Validate, retry once, typed error (BE-5) |
| Vision is async and capped at 10 pages | Start on upload, poll with backoff, validate pages on client and server |
| Web search may not find branch-level emails | Manual entry and portal link (FE-20) |
| Mail-link length on Indic text | Clipboard fallback and always-available PDF (FE-19) |
| Safari audio formats | Format negotiation in FE-5 and server-side acceptance in BE-6 |
| Credit abuse without accounts | Access code, per-IP limits, provider spend limit |

**Open questions**

- Which languages are enabled at launch? Decided by probe results; changeable in config at any time.
- Which tones are worth shipping per language, given register differences? Review during M5.
- Should custom types be allowed to be `sendable` by default, or only after the user confirms recipient use?
- Which search API will be used, and what are its free-tier limits?
- What are the Sarvam rate limits and credit allocation, so the BE-3 defaults can be set realistically?
- Which real documents and organisations will each developer test with?
