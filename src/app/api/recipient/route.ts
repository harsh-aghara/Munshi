/**
 * Recipient lookup route (BE-17).
 * Implements ambiguity checking, SSRF-safe fetch, regex address extraction, and MX checks.
 */
import { apiHandler } from '@/server/middleware';
import { RecipientRequestSchema } from '@/contracts';
import { lookupRecipient } from '@/server/search';
import { checkDailyLimit } from '@/server/rate-limit';
import { AppError } from '@/server/errors';

export const runtime = 'nodejs';
export const maxDuration = 45;

export const POST = apiHandler({
  schema: RecipientRequestSchema,
  handler: async (body, ctx) => {
    // Check daily lookup cap
    const allowed = await checkDailyLimit(ctx.ip, 'lookups', 1);
    if (!allowed) {
      throw new AppError(
        'RATE_LIMITED',
        'Daily recipient lookup limit reached for this IP.',
      );
    }

    const result = await lookupRecipient(body.hint, body.clarificationAnswer);
    return Response.json(result);
  },
});
