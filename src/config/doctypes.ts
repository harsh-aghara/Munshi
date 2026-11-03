/**
 * Writing-type registry (BE-10, BE-11, NFR-3).
 * Shared between backend and frontend. Contains no secrets.
 */

export type BlockRole =
  | 'sender'
  | 'date'
  | 'recipient'
  | 'subject'
  | 'salutation'
  | 'title'
  | 'heading'
  | 'body'
  | 'stanza'
  | 'closing'
  | 'enclosures'
  | 'disclaimer';

export type CategoryId =
  | 'complaints'
  | 'official'
  | 'emails'
  | 'academic'
  | 'creative'
  | 'custom';

export type GroundingPolicy = 'strict' | 'facts' | 'creative';
export type Layout = 'letter' | 'email' | 'prose' | 'verse';

export interface ParamDef {
  key: string;
  labelKey: string;
  kind: 'number' | 'select' | 'text' | 'toggle';
  options?: { value: string; labelKey: string }[];
  min?: number;
  max?: number;
}

export interface DocTypeDef {
  id: string;
  category: CategoryId;
  labelKey: string;
  descriptionKey: string;
  layout: Layout;
  skeleton: BlockRole[];
  requiredFacts: { key: string; labelKey: string; questionKey: string }[];
  extractableFields: { key: string; labelKey: string; hint: string }[];
  documentUpload: 'expected' | 'optional' | 'hidden';
  grounding: GroundingPolicy;
  disclaimer: boolean;
  hasRecipient: boolean;
  sendable: boolean;
  allowedTones: readonly string[] | string[] | 'all';
  defaultTone: string;
  params?: ParamDef[];
}

export interface CategoryDef {
  id: CategoryId;
  labelKey: string;
  order: number;
}

export const categories: readonly CategoryDef[] = [
  { id: 'complaints', labelKey: 'category.complaints', order: 1 },
  { id: 'official', labelKey: 'category.official', order: 2 },
  { id: 'emails', labelKey: 'category.emails', order: 3 },
  { id: 'academic', labelKey: 'category.academic', order: 4 },
  { id: 'creative', labelKey: 'category.creative', order: 5 },
  { id: 'custom', labelKey: 'category.custom', order: 6 },
] as const;

export const docTypes = [
  // ── Complaints and grievances ─────────────────────────────────────────────
  {
    id: 'grievance',
    category: 'complaints',
    labelKey: 'doctype.grievance.label',
    descriptionKey: 'doctype.grievance.desc',
    layout: 'letter',
    skeleton: [
      'sender',
      'date',
      'recipient',
      'subject',
      'salutation',
      'body',
      'closing',
      'enclosures',
      'disclaimer',
    ],
    requiredFacts: [
      { key: 'complainantName', labelKey: 'fact.complainantName', questionKey: 'question.complainantName' },
      { key: 'issue', labelKey: 'fact.issue', questionKey: 'question.issue' },
      { key: 'date_of_issue', labelKey: 'fact.date_of_issue', questionKey: 'question.date_of_issue' },
      { key: 'desired_resolution', labelKey: 'fact.desired_resolution', questionKey: 'question.desired_resolution' },
    ],
    extractableFields: [
      { key: 'accountNumber', labelKey: 'field.accountNumber', hint: 'Account or consumer ID' },
      { key: 'referenceNumber', labelKey: 'field.referenceNumber', hint: 'Complaint or ticket reference' },
      { key: 'amount', labelKey: 'field.amount', hint: 'Disputed or billed amount' },
      { key: 'address', labelKey: 'field.address', hint: 'Address or service location' },
      { key: 'contactPerson', labelKey: 'field.contactPerson', hint: 'Official or contact person named' },
    ],
    documentUpload: 'expected',
    grounding: 'strict',
    disclaimer: true,
    hasRecipient: true,
    sendable: true,
    allowedTones: ['formal', 'firm', 'assertive', 'urgent', 'neutral'],
    defaultTone: 'formal',
  },
  {
    id: 'billing_dispute',
    category: 'complaints',
    labelKey: 'doctype.billing_dispute.label',
    descriptionKey: 'doctype.billing_dispute.desc',
    layout: 'letter',
    skeleton: [
      'sender',
      'date',
      'recipient',
      'subject',
      'salutation',
      'body',
      'closing',
      'enclosures',
      'disclaimer',
    ],
    requiredFacts: [
      { key: 'accountHolder', labelKey: 'fact.accountHolder', questionKey: 'question.accountHolder' },
      { key: 'billingIssue', labelKey: 'fact.billingIssue', questionKey: 'question.billingIssue' },
      { key: 'amount', labelKey: 'fact.amount', questionKey: 'question.amount' },
      { key: 'billingDate', labelKey: 'fact.billingDate', questionKey: 'question.billingDate' },
    ],
    extractableFields: [
      { key: 'accountNumber', labelKey: 'field.accountNumber', hint: 'Account number' },
      { key: 'invoiceNumber', labelKey: 'field.invoiceNumber', hint: 'Bill or invoice number' },
      { key: 'serviceProvider', labelKey: 'field.serviceProvider', hint: 'Utility or service provider' },
      { key: 'billingPeriod', labelKey: 'field.billingPeriod', hint: 'Billing cycle or period' },
    ],
    documentUpload: 'expected',
    grounding: 'strict',
    disclaimer: true,
    hasRecipient: true,
    sendable: true,
    allowedTones: ['formal', 'firm', 'assertive', 'urgent', 'neutral'],
    defaultTone: 'formal',
  },
  {
    id: 'consumer_complaint',
    category: 'complaints',
    labelKey: 'doctype.consumer_complaint.label',
    descriptionKey: 'doctype.consumer_complaint.desc',
    layout: 'letter',
    skeleton: [
      'sender',
      'date',
      'recipient',
      'subject',
      'salutation',
      'body',
      'closing',
      'enclosures',
      'disclaimer',
    ],
    requiredFacts: [
      { key: 'complainantName', labelKey: 'fact.complainantName', questionKey: 'question.complainantName' },
      { key: 'product_or_service', labelKey: 'fact.product_or_service', questionKey: 'question.product_or_service' },
      { key: 'issue', labelKey: 'fact.issue', questionKey: 'question.issue' },
      { key: 'purchase_date', labelKey: 'fact.purchase_date', questionKey: 'question.purchase_date' },
    ],
    extractableFields: [
      { key: 'receiptNumber', labelKey: 'field.receiptNumber', hint: 'Receipt or order number' },
      { key: 'amount', labelKey: 'field.amount', hint: 'Purchase amount' },
      { key: 'seller', labelKey: 'field.seller', hint: 'Seller or vendor name' },
      { key: 'warrantyInfo', labelKey: 'field.warrantyInfo', hint: 'Warranty or guarantee details' },
    ],
    documentUpload: 'expected',
    grounding: 'strict',
    disclaimer: true,
    hasRecipient: true,
    sendable: true,
    allowedTones: ['formal', 'firm', 'assertive', 'urgent', 'neutral'],
    defaultTone: 'formal',
  },

  // ── Official requests ─────────────────────────────────────────────────────
  {
    id: 'rti',
    category: 'official',
    labelKey: 'doctype.rti.label',
    descriptionKey: 'doctype.rti.desc',
    layout: 'letter',
    skeleton: [
      'sender',
      'date',
      'recipient',
      'subject',
      'salutation',
      'body',
      'closing',
      'disclaimer',
    ],
    requiredFacts: [
      { key: 'applicantName', labelKey: 'fact.applicantName', questionKey: 'question.applicantName' },
      { key: 'informationSought', labelKey: 'fact.informationSought', questionKey: 'question.informationSought' },
      { key: 'publicAuthority', labelKey: 'fact.publicAuthority', questionKey: 'question.publicAuthority' },
      { key: 'purpose', labelKey: 'fact.purpose', questionKey: 'question.purpose' },
    ],
    extractableFields: [
      { key: 'referenceNumber', labelKey: 'field.referenceNumber', hint: 'Previous application or letter ref' },
      { key: 'date_of_action', labelKey: 'field.date_of_action', hint: 'Date of incident or application' },
    ],
    documentUpload: 'optional',
    grounding: 'strict',
    disclaimer: true,
    hasRecipient: true,
    sendable: true,
    allowedTones: ['formal', 'neutral', 'firm'],
    defaultTone: 'formal',
  },
  {
    id: 'formal_application',
    category: 'official',
    labelKey: 'doctype.formal_application.label',
    descriptionKey: 'doctype.formal_application.desc',
    layout: 'letter',
    skeleton: [
      'sender',
      'date',
      'recipient',
      'subject',
      'salutation',
      'body',
      'closing',
      'enclosures',
      'disclaimer',
    ],
    requiredFacts: [
      { key: 'applicantName', labelKey: 'fact.applicantName', questionKey: 'question.applicantName' },
      { key: 'purpose', labelKey: 'fact.purpose', questionKey: 'question.purpose' },
      { key: 'authority', labelKey: 'fact.authority', questionKey: 'question.authority' },
    ],
    extractableFields: [
      { key: 'referenceNumber', labelKey: 'field.referenceNumber', hint: 'Reference or registration number' },
      { key: 'date_of_submission', labelKey: 'field.date_of_submission', hint: 'Submission date' },
    ],
    documentUpload: 'optional',
    grounding: 'strict',
    disclaimer: true,
    hasRecipient: true,
    sendable: true,
    allowedTones: ['formal', 'polite', 'neutral'],
    defaultTone: 'formal',
  },
  {
    id: 'certificate_request',
    category: 'official',
    labelKey: 'doctype.certificate_request.label',
    descriptionKey: 'doctype.certificate_request.desc',
    layout: 'letter',
    skeleton: [
      'sender',
      'date',
      'recipient',
      'subject',
      'salutation',
      'body',
      'closing',
      'enclosures',
      'disclaimer',
    ],
    requiredFacts: [
      { key: 'applicantName', labelKey: 'fact.applicantName', questionKey: 'question.applicantName' },
      { key: 'certificateType', labelKey: 'fact.certificateType', questionKey: 'question.certificateType' },
      { key: 'reason', labelKey: 'fact.reason', questionKey: 'question.reason' },
    ],
    extractableFields: [
      { key: 'dates', labelKey: 'field.dates', hint: 'Relevant service/study dates' },
      { key: 'department', labelKey: 'field.department', hint: 'Department or branch' },
      { key: 'employeeId', labelKey: 'field.employeeId', hint: 'ID or roll number' },
    ],
    documentUpload: 'optional',
    grounding: 'strict',
    disclaimer: true,
    hasRecipient: true,
    sendable: true,
    allowedTones: ['formal', 'polite', 'neutral'],
    defaultTone: 'formal',
  },

  // ── Emails and letters ───────────────────────────────────────────────────
  {
    id: 'internship_email',
    category: 'emails',
    labelKey: 'doctype.internship_email.label',
    descriptionKey: 'doctype.internship_email.desc',
    layout: 'email',
    skeleton: ['subject', 'salutation', 'body', 'closing'],
    requiredFacts: [
      { key: 'applicantName', labelKey: 'fact.applicantName', questionKey: 'question.applicantName' },
      { key: 'targetRole', labelKey: 'fact.targetRole', questionKey: 'question.targetRole' },
      { key: 'organization', labelKey: 'fact.organization', questionKey: 'question.organization' },
    ],
    extractableFields: [
      { key: 'referenceNumber', labelKey: 'field.referenceNumber', hint: 'Posting ID or ref' },
      { key: 'department', labelKey: 'field.department', hint: 'Team or department' },
      { key: 'deadline', labelKey: 'field.deadline', hint: 'Application deadline' },
    ],
    documentUpload: 'optional',
    grounding: 'facts',
    disclaimer: false,
    hasRecipient: true,
    sendable: true,
    allowedTones: [
      'formal',
      'polite',
      'professional',
      'neutral',
      'enthusiastic',
      'persuasive',
      'friendly',
    ],
    defaultTone: 'professional',
  },
  {
    id: 'job_application',
    category: 'emails',
    labelKey: 'doctype.job_application.label',
    descriptionKey: 'doctype.job_application.desc',
    layout: 'email',
    skeleton: ['subject', 'salutation', 'body', 'closing'],
    requiredFacts: [
      { key: 'applicantName', labelKey: 'fact.applicantName', questionKey: 'question.applicantName' },
      { key: 'position', labelKey: 'fact.position', questionKey: 'question.position' },
      { key: 'organization', labelKey: 'fact.organization', questionKey: 'question.organization' },
    ],
    extractableFields: [
      { key: 'referenceNumber', labelKey: 'field.referenceNumber', hint: 'Job ID' },
      { key: 'salaryExpectation', labelKey: 'field.salaryExpectation', hint: 'Expected compensation' },
    ],
    documentUpload: 'optional',
    grounding: 'facts',
    disclaimer: false,
    hasRecipient: true,
    sendable: true,
    allowedTones: ['formal', 'professional', 'persuasive', 'polite'],
    defaultTone: 'professional',
  },
  {
    id: 'leave_email',
    category: 'emails',
    labelKey: 'doctype.leave_email.label',
    descriptionKey: 'doctype.leave_email.desc',
    layout: 'email',
    skeleton: ['subject', 'salutation', 'body', 'closing'],
    requiredFacts: [
      { key: 'applicantName', labelKey: 'fact.applicantName', questionKey: 'question.applicantName' },
      { key: 'leaveType', labelKey: 'fact.leaveType', questionKey: 'question.leaveType' },
      { key: 'dates', labelKey: 'fact.dates', questionKey: 'question.dates' },
      { key: 'reason', labelKey: 'fact.reason', questionKey: 'question.reason' },
    ],
    extractableFields: [],
    documentUpload: 'optional',
    grounding: 'facts',
    disclaimer: false,
    hasRecipient: true,
    sendable: true,
    allowedTones: ['formal', 'polite', 'professional', 'neutral'],
    defaultTone: 'formal',
  },
  {
    id: 'resignation',
    category: 'emails',
    labelKey: 'doctype.resignation.label',
    descriptionKey: 'doctype.resignation.desc',
    layout: 'letter',
    skeleton: ['sender', 'date', 'recipient', 'subject', 'salutation', 'body', 'closing'],
    requiredFacts: [
      { key: 'employeeName', labelKey: 'fact.employeeName', questionKey: 'question.employeeName' },
      { key: 'position', labelKey: 'fact.position', questionKey: 'question.position' },
      { key: 'lastDay', labelKey: 'fact.lastDay', questionKey: 'question.lastDay' },
    ],
    extractableFields: [],
    documentUpload: 'optional',
    grounding: 'facts',
    disclaimer: false,
    hasRecipient: true,
    sendable: true,
    allowedTones: ['formal', 'polite', 'professional', 'appreciative'],
    defaultTone: 'professional',
  },
  {
    id: 'recommendation_request',
    category: 'emails',
    labelKey: 'doctype.recommendation_request.label',
    descriptionKey: 'doctype.recommendation_request.desc',
    layout: 'email',
    skeleton: ['subject', 'salutation', 'body', 'closing'],
    requiredFacts: [
      { key: 'applicantName', labelKey: 'fact.applicantName', questionKey: 'question.applicantName' },
      { key: 'purpose', labelKey: 'fact.purpose', questionKey: 'question.purpose' },
      { key: 'relationship', labelKey: 'fact.relationship', questionKey: 'question.relationship' },
    ],
    extractableFields: [],
    documentUpload: 'optional',
    grounding: 'facts',
    disclaimer: false,
    hasRecipient: true,
    sendable: true,
    allowedTones: ['polite', 'professional', 'appreciative', 'friendly'],
    defaultTone: 'polite',
  },
  {
    id: 'followup',
    category: 'emails',
    labelKey: 'doctype.followup.label',
    descriptionKey: 'doctype.followup.desc',
    layout: 'email',
    skeleton: ['subject', 'salutation', 'body', 'closing'],
    requiredFacts: [
      { key: 'applicantName', labelKey: 'fact.applicantName', questionKey: 'question.applicantName' },
      { key: 'originalSubject', labelKey: 'fact.originalSubject', questionKey: 'question.originalSubject' },
      { key: 'date_of_original', labelKey: 'fact.date_of_original', questionKey: 'question.date_of_original' },
    ],
    extractableFields: [],
    documentUpload: 'optional',
    grounding: 'facts',
    disclaimer: false,
    hasRecipient: true,
    sendable: true,
    allowedTones: ['polite', 'professional', 'firm', 'urgent'],
    defaultTone: 'polite',
  },
  {
    id: 'thankyou',
    category: 'emails',
    labelKey: 'doctype.thankyou.label',
    descriptionKey: 'doctype.thankyou.desc',
    layout: 'email',
    skeleton: ['subject', 'salutation', 'body', 'closing'],
    requiredFacts: [],
    extractableFields: [],
    documentUpload: 'hidden',
    grounding: 'facts',
    disclaimer: false,
    hasRecipient: false,
    sendable: false,
    allowedTones: ['appreciative', 'warm', 'friendly', 'polite'],
    defaultTone: 'appreciative',
  },
  {
    id: 'general_email',
    category: 'emails',
    labelKey: 'doctype.general_email.label',
    descriptionKey: 'doctype.general_email.desc',
    layout: 'email',
    skeleton: ['subject', 'salutation', 'body', 'closing'],
    requiredFacts: [
      { key: 'senderName', labelKey: 'fact.senderName', questionKey: 'question.senderName' },
      { key: 'purpose', labelKey: 'fact.purpose', questionKey: 'question.purpose' },
    ],
    extractableFields: [],
    documentUpload: 'optional',
    grounding: 'facts',
    disclaimer: false,
    hasRecipient: true,
    sendable: true,
    allowedTones: 'all',
    defaultTone: 'professional',
  },
  {
    id: 'general_letter',
    category: 'emails',
    labelKey: 'doctype.general_letter.label',
    descriptionKey: 'doctype.general_letter.desc',
    layout: 'letter',
    skeleton: ['sender', 'date', 'recipient', 'subject', 'salutation', 'body', 'closing'],
    requiredFacts: [
      { key: 'senderName', labelKey: 'fact.senderName', questionKey: 'question.senderName' },
      { key: 'purpose', labelKey: 'fact.purpose', questionKey: 'question.purpose' },
    ],
    extractableFields: [],
    documentUpload: 'optional',
    grounding: 'facts',
    disclaimer: false,
    hasRecipient: true,
    sendable: true,
    allowedTones: 'all',
    defaultTone: 'formal',
  },

  // ── Academic and professional ─────────────────────────────────────────────
  {
    id: 'abstract',
    category: 'academic',
    labelKey: 'doctype.abstract.label',
    descriptionKey: 'doctype.abstract.desc',
    layout: 'prose',
    skeleton: ['title', 'body'],
    requiredFacts: [
      { key: 'topic', labelKey: 'fact.topic', questionKey: 'question.topic' },
    ],
    extractableFields: [
      { key: 'authors', labelKey: 'field.authors', hint: 'Authors or researchers' },
      { key: 'keywords', labelKey: 'field.keywords', hint: 'Key domain terms' },
    ],
    documentUpload: 'optional',
    grounding: 'facts',
    disclaimer: false,
    hasRecipient: false,
    sendable: false,
    allowedTones: ['formal', 'professional', 'neutral'],
    defaultTone: 'professional',
    params: [
      {
        key: 'wordLimit',
        labelKey: 'param.wordLimit',
        kind: 'number',
        min: 50,
        max: 500,
      },
    ],
  },
  {
    id: 'sop',
    category: 'academic',
    labelKey: 'doctype.sop.label',
    descriptionKey: 'doctype.sop.desc',
    layout: 'prose',
    skeleton: ['title', 'body'],
    requiredFacts: [
      { key: 'applicantName', labelKey: 'fact.applicantName', questionKey: 'question.applicantName' },
      { key: 'program', labelKey: 'fact.program', questionKey: 'question.program' },
      { key: 'institution', labelKey: 'fact.institution', questionKey: 'question.institution' },
    ],
    extractableFields: [],
    documentUpload: 'optional',
    grounding: 'facts',
    disclaimer: false,
    hasRecipient: false,
    sendable: false,
    allowedTones: ['professional', 'persuasive', 'inspirational', 'formal'],
    defaultTone: 'persuasive',
  },
  {
    id: 'summary',
    category: 'academic',
    labelKey: 'doctype.summary.label',
    descriptionKey: 'doctype.summary.desc',
    layout: 'prose',
    skeleton: ['title', 'body'],
    requiredFacts: [
      { key: 'topic', labelKey: 'fact.topic', questionKey: 'question.topic' },
    ],
    extractableFields: [],
    documentUpload: 'optional',
    grounding: 'facts',
    disclaimer: false,
    hasRecipient: false,
    sendable: false,
    allowedTones: ['neutral', 'formal', 'professional'],
    defaultTone: 'neutral',
    params: [
      {
        key: 'wordLimit',
        labelKey: 'param.wordLimit',
        kind: 'number',
        min: 50,
        max: 1000,
      },
    ],
  },
  {
    id: 'meeting_minutes',
    category: 'academic',
    labelKey: 'doctype.meeting_minutes.label',
    descriptionKey: 'doctype.meeting_minutes.desc',
    layout: 'prose',
    skeleton: ['title', 'heading', 'body'],
    requiredFacts: [
      { key: 'meetingDate', labelKey: 'fact.meetingDate', questionKey: 'question.meetingDate' },
      { key: 'attendees', labelKey: 'fact.attendees', questionKey: 'question.attendees' },
      { key: 'agenda', labelKey: 'fact.agenda', questionKey: 'question.agenda' },
    ],
    extractableFields: [],
    documentUpload: 'optional',
    grounding: 'facts',
    disclaimer: false,
    hasRecipient: false,
    sendable: false,
    allowedTones: ['neutral', 'professional', 'formal'],
    defaultTone: 'neutral',
  },

  // ── Creative ─────────────────────────────────────────────────────────────
  {
    id: 'poem',
    category: 'creative',
    labelKey: 'doctype.poem.label',
    descriptionKey: 'doctype.poem.desc',
    layout: 'verse',
    skeleton: ['title', 'stanza'],
    requiredFacts: [],
    extractableFields: [],
    documentUpload: 'hidden',
    grounding: 'creative',
    disclaimer: false,
    hasRecipient: false,
    sendable: false,
    allowedTones: ['poetic', 'humorous', 'inspirational', 'reflective', 'warm', 'empathetic'],
    defaultTone: 'poetic',
    params: [
      {
        key: 'form',
        labelKey: 'param.poemForm',
        kind: 'select',
        options: [
          { value: 'free', labelKey: 'param.poemForm.free' },
          { value: 'haiku', labelKey: 'param.poemForm.haiku' },
          { value: 'sonnet', labelKey: 'param.poemForm.sonnet' },
          { value: 'ghazal', labelKey: 'param.poemForm.ghazal' },
        ],
      },
    ],
  },
  {
    id: 'short_story',
    category: 'creative',
    labelKey: 'doctype.short_story.label',
    descriptionKey: 'doctype.short_story.desc',
    layout: 'prose',
    skeleton: ['title', 'body'],
    requiredFacts: [],
    extractableFields: [],
    documentUpload: 'hidden',
    grounding: 'creative',
    disclaimer: false,
    hasRecipient: false,
    sendable: false,
    allowedTones: 'all',
    defaultTone: 'reflective',
  },
  {
    id: 'speech_toast',
    category: 'creative',
    labelKey: 'doctype.speech_toast.label',
    descriptionKey: 'doctype.speech_toast.desc',
    layout: 'prose',
    skeleton: ['title', 'body'],
    requiredFacts: [
      { key: 'occasion', labelKey: 'fact.occasion', questionKey: 'question.occasion' },
    ],
    extractableFields: [],
    documentUpload: 'hidden',
    grounding: 'creative',
    disclaimer: false,
    hasRecipient: false,
    sendable: false,
    allowedTones: ['inspirational', 'humorous', 'warm', 'friendly', 'appreciative', 'formal'],
    defaultTone: 'warm',
  },
  {
    id: 'greeting',
    category: 'creative',
    labelKey: 'doctype.greeting.label',
    descriptionKey: 'doctype.greeting.desc',
    layout: 'prose',
    skeleton: ['title', 'body'],
    requiredFacts: [
      { key: 'occasion', labelKey: 'fact.occasion', questionKey: 'question.occasion' },
    ],
    extractableFields: [],
    documentUpload: 'hidden',
    grounding: 'creative',
    disclaimer: false,
    hasRecipient: false,
    sendable: false,
    allowedTones: ['warm', 'friendly', 'appreciative', 'humorous', 'poetic'],
    defaultTone: 'friendly',
  },

  // ── Custom ────────────────────────────────────────────────────────────────
  {
    id: 'custom',
    category: 'custom',
    labelKey: 'doctype.custom.label',
    descriptionKey: 'doctype.custom.desc',
    layout: 'prose',
    skeleton: ['title', 'body'],
    requiredFacts: [],
    extractableFields: [],
    documentUpload: 'optional',
    grounding: 'facts',
    disclaimer: false,
    hasRecipient: false,
    sendable: false,
    allowedTones: 'all',
    defaultTone: 'neutral',
  },
] as const satisfies readonly DocTypeDef[];

export type DocTypeId = (typeof docTypes)[number]['id'];

export const docTypeMap: Record<string, DocTypeDef> = Object.fromEntries(
  docTypes.map((d) => [d.id, d]),
);

export function getDocType(id: string): DocTypeDef | undefined {
  return docTypeMap[id];
}

export function isValidDocType(id: string): boolean {
  return id === 'auto' || id === 'custom' || Boolean(docTypeMap[id]);
}

export function getTypesForCategory(categoryId: CategoryId): DocTypeDef[] {
  return docTypes.filter((d) => d.category === categoryId);
}
