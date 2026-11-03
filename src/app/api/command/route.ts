/**
 * Command routing route (BE-14).
 * Classifies user intent and returns structured action payloads.
 */
import { apiHandler } from '@/server/middleware';
import { CommandRequestSchema } from '@/contracts';
import { routeCommand } from '@/server/command';

export const runtime = 'nodejs';
export const maxDuration = 30;

export const POST = apiHandler({
  schema: CommandRequestSchema,
  handler: async (body) => {
    const result = await routeCommand(body);
    return Response.json(result);
  },
});
