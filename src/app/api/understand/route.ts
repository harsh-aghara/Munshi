/**
 * Understand route (BE-9, BE-11).
 * Extracts facts, verifies evidence, flags conflicts/corrections, classifies doctype.
 */
import { apiHandler } from '@/server/middleware';
import { UnderstandRequestSchema } from '@/contracts';
import { processUnderstand } from '@/server/understand';

export const runtime = 'nodejs';
export const maxDuration = 60;

export const POST = apiHandler({
  schema: UnderstandRequestSchema,
  handler: async (body) => {
    const caseState = await processUnderstand(body);
    return Response.json(caseState);
  },
});
