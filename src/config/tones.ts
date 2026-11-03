/**
 * Tone configuration (BE-18, NFR-3).
 * Shared between backend and frontend. Contains no secrets.
 */

export type CategoryId =
  | 'complaints'
  | 'official'
  | 'emails'
  | 'academic'
  | 'creative'
  | 'custom';

export interface ToneDef {
  id: string;
  labelKey: string;
  guidance: string;
  categories: CategoryId[] | 'all';
}

export const tones = [
  {
    id: 'formal',
    labelKey: 'tone.formal',
    guidance:
      'Use formal, respectful language. Avoid contractions and colloquialisms. Maintain professional distance.',
    categories: ['complaints', 'official', 'emails', 'academic', 'custom'],
  },
  {
    id: 'polite',
    labelKey: 'tone.polite',
    guidance:
      'Use courteous, considerate language. Express requests gently. Show deference where appropriate.',
    categories: ['complaints', 'official', 'emails', 'academic', 'custom'],
  },
  {
    id: 'professional',
    labelKey: 'tone.professional',
    guidance:
      'Use clear, business-appropriate language. Be concise and direct while remaining courteous.',
    categories: ['complaints', 'official', 'emails', 'academic', 'custom'],
  },
  {
    id: 'neutral',
    labelKey: 'tone.neutral',
    guidance:
      'Use plain, straightforward language without strong emotion or emphasis. State facts clearly.',
    categories: 'all',
  },
  {
    id: 'firm',
    labelKey: 'tone.firm',
    guidance:
      'Use strong, decisive language. State expectations clearly. Be direct without being rude.',
    categories: ['complaints', 'official', 'emails'],
  },
  {
    id: 'assertive',
    labelKey: 'tone.assertive',
    guidance:
      'Use confident, direct language. Emphasise rights and expectations. Maintain respect.',
    categories: ['complaints', 'official', 'emails'],
  },
  {
    id: 'urgent',
    labelKey: 'tone.urgent',
    guidance:
      'Convey immediacy and importance. Use short, impactful sentences. Highlight time sensitivity.',
    categories: ['complaints', 'official', 'emails'],
  },
  {
    id: 'empathetic',
    labelKey: 'tone.empathetic',
    guidance:
      'Show understanding and compassion. Acknowledge feelings and difficulties. Use warm, supportive language.',
    categories: ['emails', 'complaints', 'creative'],
  },
  {
    id: 'appreciative',
    labelKey: 'tone.appreciative',
    guidance:
      'Express gratitude and recognition. Highlight positive aspects. Be warm and sincere.',
    categories: ['emails', 'complaints', 'creative'],
  },
  {
    id: 'apologetic',
    labelKey: 'tone.apologetic',
    guidance:
      'Express regret sincerely. Take responsibility where appropriate. Offer resolution.',
    categories: ['emails', 'complaints', 'creative'],
  },
  {
    id: 'friendly',
    labelKey: 'tone.friendly',
    guidance:
      'Use casual, warm language. Be personable and approachable. Light humor is acceptable where appropriate.',
    categories: ['emails', 'creative'],
  },
  {
    id: 'warm',
    labelKey: 'tone.warm',
    guidance:
      'Use affectionate, caring language. Express genuine concern and kindness.',
    categories: ['emails', 'creative'],
  },
  {
    id: 'persuasive',
    labelKey: 'tone.persuasive',
    guidance:
      'Build a compelling case. Use rhetorical techniques. Appeal to logic and emotion.',
    categories: ['emails', 'academic', 'creative'],
  },
  {
    id: 'poetic',
    labelKey: 'tone.poetic',
    guidance:
      'Use figurative language, imagery, and rhythm. Evoke emotions through word choice.',
    categories: ['creative', 'emails'],
  },
  {
    id: 'humorous',
    labelKey: 'tone.humorous',
    guidance:
      'Use wit, wordplay, and light-hearted observations. Keep it tasteful and appropriate.',
    categories: ['creative', 'emails'],
  },
  {
    id: 'inspirational',
    labelKey: 'tone.inspirational',
    guidance:
      'Use uplifting, motivating language. Appeal to values and aspirations.',
    categories: ['creative', 'emails'],
  },
  {
    id: 'reflective',
    labelKey: 'tone.reflective',
    guidance:
      'Use contemplative, thoughtful language. Explore ideas and memories with depth.',
    categories: ['creative', 'emails'],
  },
] as const satisfies readonly ToneDef[];

export type ToneId = (typeof tones)[number]['id'];

export const toneMap: Record<string, ToneDef> = Object.fromEntries(
  tones.map((t) => [t.id, t]),
);

export function getTone(id: string): ToneDef | undefined {
  return toneMap[id];
}

export function isValidTone(id: string): boolean {
  return Boolean(toneMap[id]);
}

export function getTonesForCategory(categoryId: CategoryId): ToneDef[] {
  return tones.filter(
    (t) => t.categories === 'all' || (t.categories as CategoryId[]).includes(categoryId),
  );
}

export function isToneAllowedForType(
  toneId: string,
  allowedTones: readonly string[] | string[] | 'all',
  categoryId?: CategoryId,
): boolean {
  if (allowedTones === 'all') {
    if (!categoryId) return true;
    const tone = getTone(toneId);
    if (!tone) return false;
    return tone.categories === 'all' || (tone.categories as CategoryId[]).includes(categoryId);
  }
  return allowedTones.includes(toneId);
}
