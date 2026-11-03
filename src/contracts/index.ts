import { z } from "zod";

// ── Base scalar types ───────────────────────────────────────────────────────

/** BCP-47 language code, e.g. 'hi-IN' */
export const LangSchema = z.string().min(2);
export type Lang = z.infer<typeof LangSchema>;

/** Key from doctypes config, or 'auto' / 'custom' */
export const DocTypeIdSchema = z.string().min(1);
export type DocTypeId = z.infer<typeof DocTypeIdSchema>;

/** Key from tones config */
export const ToneIdSchema = z.string().min(1);
export type ToneId = z.infer<typeof ToneIdSchema>;

export const BlockRoleSchema = z.enum([
  "sender",
  "date",
  "recipient",
  "subject",
  "salutation",
  "title",
  "heading",
  "body",
  "stanza",
  "closing",
  "enclosures",
  "disclaimer",
]);
export type BlockRole = z.infer<typeof BlockRoleSchema>;

export const ToneChoiceSchema = z.union([
  z.object({ id: ToneIdSchema }),
  z.object({ custom: z.string().max(120) }),
]);
export type ToneChoice = z.infer<typeof ToneChoiceSchema>;

// ── Core data schemas ───────────────────────────────────────────────────────

export const SegmentSchema = z.object({
  id: z.string(),
  startMs: z
    .union([z.number(), z.null(), z.undefined()])
    .transform((val) => (typeof val === 'number' && !isNaN(val) ? val : 0)),
  endMs: z
    .union([z.number(), z.null(), z.undefined()])
    .transform((val) => (typeof val === 'number' && !isNaN(val) ? val : 0)),
  text: z.string(),
  lang: LangSchema,
});
export type Segment = z.infer<typeof SegmentSchema>;

export const EvidenceSchema = z.object({
  id: z.string(),
  kind: z.enum(["speech", "document"]),
  segmentId: z.string().optional(),
  docId: z.string().optional(),
  page: z.number().optional(),
  snippet: z.string(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const FactAlternativeSchema = z.object({
  value: z.string(),
  evidenceIds: z.array(z.string()),
});

export const FactSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.string(),
  evidenceIds: z.array(z.string()),
  confidence: z.number(),
  status: z.enum(["extracted", "corrected", "confirmed", "conflict"]),
  previousValue: z.string().optional(),
  alternatives: z.array(FactAlternativeSchema).optional(),
});
export type Fact = z.infer<typeof FactSchema>;

export const MissingFactSchema = z.object({
  key: z.string(),
  label: z.string(),
  question: z.string(),
  required: z.boolean(),
});
export type MissingFact = z.infer<typeof MissingFactSchema>;

export const ContactSchema = z.object({
  id: z.string(),
  email: z.string(),
  label: z.string(),
  origin: z.enum(["document", "web"]),
  trust: z.enum(["from_user_doc", "official", "third_party"]),
  sourceUrl: z.string().optional(),
  snippet: z.string(),
  mxOk: z.boolean().optional(),
  needsConfirmation: z.boolean().optional(),
});
export type Contact = z.infer<typeof ContactSchema>;

export const RecipientHintSchema = z.object({
  raw: z.string(),
  org: z.string(),
  dept: z.string().optional(),
  location: z.string().optional(),
});
export type RecipientHint = z.infer<typeof RecipientHintSchema>;

export const LayoutSchema = z.enum(["letter", "email", "prose", "verse"]);
export type LayoutType = z.infer<typeof LayoutSchema>;

export const CustomDefSchema = z.object({
  label: z.string(),
  layout: LayoutSchema,
  skeleton: z.array(BlockRoleSchema),
  requiredFacts: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      question: z.string(),
    }),
  ),
  sendable: z.boolean(),
  hasRecipient: z.boolean(),
});
export type CustomDef = z.infer<typeof CustomDefSchema>;

export const PrefsSchema = z.object({
  uiLang: LangSchema,
  dictationLang: z.union([LangSchema, z.literal("auto")]),
  letterLang: z.union([LangSchema, z.literal("same")]),
  tone: ToneChoiceSchema.optional(),
  lastDocType: DocTypeIdSchema.optional(),
});
export type Prefs = z.infer<typeof PrefsSchema>;

export const DocSchema = z.object({
  id: z.string(),
  name: z.string(),
  pages: z.number(),
  markdown: z.string(),
});
export type Doc = z.infer<typeof DocSchema>;
export type CaseDoc = Doc;


export const CaseStateSchema = z.object({
  caseId: z.string(),
  docType: DocTypeIdSchema,
  docTypeSource: z.enum(["user", "auto"]),
  docTypeConfidence: z.number().optional(),
  customBrief: z.string().optional(),
  customDef: CustomDefSchema.optional(),
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  inputLang: LangSchema,
  segments: z.array(SegmentSchema),
  evidence: z.array(EvidenceSchema),
  docs: z.array(DocSchema),
  facts: z.array(FactSchema),
  missing: z.array(MissingFactSchema),
  contacts: z.array(ContactSchema),
  recipientHint: RecipientHintSchema.optional(),
  round: z.number(),
});
export type CaseState = z.infer<typeof CaseStateSchema>;

export const DraftBlockSchema = z.object({
  id: z.string(),
  role: BlockRoleSchema,
  text: z.string(),
  evidenceIds: z.array(z.string()),
  grounding: z.enum(["verified", "unverified"]),
  locked: z.boolean().optional(),
});
export type DraftBlock = z.infer<typeof DraftBlockSchema>;

export const DraftSchema = z.object({
  caseId: z.string(),
  version: z.number(),
  lang: LangSchema,
  docType: DocTypeIdSchema,
  layout: z.enum(["letter", "email", "prose", "verse"]),
  tone: ToneChoiceSchema,
  blocks: z.array(DraftBlockSchema),
});
export type Draft = z.infer<typeof DraftSchema>;

// ── Intent / Command ────────────────────────────────────────────────────────

export const IntentSchema = z.enum([
  "EDIT",
  "TRANSLATE",
  "SET_TONE",
  "SET_DOCTYPE",
  "READ_ALOUD",
  "EXPORT",
  "SET_RECIPIENT",
  "SEND",
  "UNDO",
  "REDO",
  "UNKNOWN",
]);
export type Intent = z.infer<typeof IntentSchema>;

export const CommandResultSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("EDIT"), instruction: z.string() }),
  z.object({ intent: z.literal("TRANSLATE"), targetLang: LangSchema }),
  z.object({ intent: z.literal("SET_TONE"), tone: ToneChoiceSchema }),
  z.object({ intent: z.literal("SET_DOCTYPE"), docType: DocTypeIdSchema }),
  z.object({ intent: z.literal("SET_RECIPIENT"), hint: RecipientHintSchema }),
  z.object({ intent: z.literal("READ_ALOUD") }),
  z.object({ intent: z.literal("EXPORT") }),
  z.object({ intent: z.literal("SEND") }),
  z.object({ intent: z.literal("UNDO") }),
  z.object({ intent: z.literal("REDO") }),
  z.object({ intent: z.literal("UNKNOWN") }),
]);
export type CommandResult = z.infer<typeof CommandResultSchema>;

// ── Lookup ──────────────────────────────────────────────────────────────────

export const LookupResultSchema = z.object({
  status: z.enum(["ok", "needs_clarification", "not_found"]),
  candidates: z.array(ContactSchema),
  portalUrl: z.string().optional(),
  clarification: z
    .object({
      question: z.string(),
      options: z.array(z.string()).optional(),
    })
    .optional(),
});
export type LookupResult = z.infer<typeof LookupResultSchema>;

// ── API Error ───────────────────────────────────────────────────────────────

export const ApiErrorCodeSchema = z.enum([
  "ACCESS_DENIED",
  "RATE_LIMITED",
  "VALIDATION_FAILED",
  "UNSUPPORTED_LANGUAGE",
  "FILE_UNSUPPORTED",
  "UPSTREAM_TIMEOUT",
  "UPSTREAM_ERROR",
  "LLM_INVALID_OUTPUT",
  "INTERNAL",
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorSchema = z.object({
  code: ApiErrorCodeSchema,
  message: z.string(),
  retryable: z.boolean(),
  requestId: z.string(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// ── Draft stream frames ────────────────────────────────────────────────────

export const DraftEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("block"), block: DraftBlockSchema }),
  z.object({
    type: z.literal("done"),
    draft: DraftSchema,
    changedBlockIds: z.array(z.string()).optional(),
  }),
  z.object({ type: z.literal("error"), error: ApiErrorSchema }),
]);
export type DraftEvent = z.infer<typeof DraftEventSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// API Request / Response schemas
// ═══════════════════════════════════════════════════════════════════════════

// ── POST /api/stt ───────────────────────────────────────────────────────────

/** Audio binary is sent as FormData; lang is extracted from the form field. */
export const SttRequestSchema = z.object({
  lang: LangSchema,
});
export type SttRequest = z.infer<typeof SttRequestSchema>;

export const SttResponseSchema = z.object({
  segments: z.array(SegmentSchema),
});
export type SttResponse = z.infer<typeof SttResponseSchema>;

// ── POST /api/vision ────────────────────────────────────────────────────────

/** File binary is sent as FormData; schema only covers the JSON response. */
export const VisionResponseSchema = z.object({
  jobId: z.string(),
});
export type VisionResponse = z.infer<typeof VisionResponseSchema>;

// ── GET /api/vision/status ──────────────────────────────────────────────────

export const VisionStatusRequestSchema = z.object({
  jobId: z.string(),
});
export type VisionStatusRequest = z.infer<typeof VisionStatusRequestSchema>;

export const VisionStatusResponseSchema = z.object({
  state: z.enum(["processing", "done", "failed"]),
  progress: z.number().optional(),
  pages: z.number().optional(),
  markdown: z.string().optional(),
  fields: z.array(FactSchema).optional(),
  contacts: z.array(ContactSchema).optional(),
});
export type VisionStatusResponse = z.infer<typeof VisionStatusResponseSchema>;

// ── POST /api/understand ────────────────────────────────────────────────────

export const UnderstandRequestSchema = z.object({
  docTypeId: DocTypeIdSchema,
  customBrief: z.string().optional(),
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  segments: z.array(SegmentSchema),
  docs: z.array(DocSchema),
  inputLang: LangSchema,
  previousCase: CaseStateSchema.optional(),
  answers: z.record(z.string(), z.string()).optional(),
});
export type UnderstandRequest = z.infer<typeof UnderstandRequestSchema>;

export const UnderstandResponseSchema = CaseStateSchema;
export type UnderstandResponse = CaseState;

// ── POST /api/draft ─────────────────────────────────────────────────────────

export const DraftRequestSchema = z.object({
  case: CaseStateSchema,
  letterLang: LangSchema,
  tone: ToneChoiceSchema,
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  today: z.string(),
  mode: z.literal("rewrite").optional(),
  instruction: z.string().optional(),
  toneChange: ToneChoiceSchema.optional(),
  currentDraft: DraftSchema.optional(),
});
export type DraftRequest = z.infer<typeof DraftRequestSchema>;

/** Response is a stream of DraftEvent frames (NDJSON). */
export const DraftResponseEventSchema = DraftEventSchema;
export type DraftResponseEvent = DraftEvent;

// ── POST /api/command ───────────────────────────────────────────────────────

export const CommandRequestSchema = z.object({
  text: z.string(),
  draft: DraftSchema,
  case: CaseStateSchema,
});
export type CommandRequest = z.infer<typeof CommandRequestSchema>;

export const CommandResponseSchema = CommandResultSchema;
export type CommandResponse = CommandResult;

// ── POST /api/translate ─────────────────────────────────────────────────────

export const TranslateRequestSchema = z.object({
  draft: DraftSchema,
  targetLang: LangSchema,
});
export type TranslateRequest = z.infer<typeof TranslateRequestSchema>;

export const TranslateResponseSchema = DraftSchema;
export type TranslateResponse = Draft;

// ── POST /api/tts ───────────────────────────────────────────────────────────

/** Response is audio binary, not JSON. */
export const TtsRequestSchema = z.object({
  text: z.string(),
  lang: LangSchema,
});
export type TtsRequest = z.infer<typeof TtsRequestSchema>;

// ── POST /api/recipient ─────────────────────────────────────────────────────

export const RecipientRequestSchema = z.object({
  hint: RecipientHintSchema,
  clarificationAnswer: z.string().optional(),
});
export type RecipientRequest = z.infer<typeof RecipientRequestSchema>;

export const RecipientResponseSchema = LookupResultSchema;
export type RecipientResponse = LookupResult;
