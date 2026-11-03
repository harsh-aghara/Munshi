/**
 * Translation route (BE-15).
 * Translates draft block by block, verifying identifier preservation and keeping disclaimer.
 */
import { apiHandler } from '@/server/middleware';
import { TranslateRequestSchema } from '@/contracts';
import { translateDraft } from '@/server/sarvam/translate';

export const runtime = 'nodejs';
export const maxDuration = 60;

export const POST = apiHandler({
  schema: TranslateRequestSchema,
  handler: async (body) => {
    const translated = await translateDraft(body.draft, body.targetLang);
    return Response.json(translated);
  },
});
