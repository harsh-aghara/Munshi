/**
 * Draft generation and streaming route (BE-12, BE-13).
 * Streams DraftEvent objects over a ReadableStream in NDJSON format.
 */
import { apiHandler } from '@/server/middleware';
import { DraftRequestSchema, type DraftEvent } from '@/contracts';
import { generateDraft } from '@/server/draft';

export const runtime = 'nodejs';
export const maxDuration = 60;

export const POST = apiHandler({
  schema: DraftRequestSchema,
  handler: async (body, ctx) => {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const { events } = await generateDraft(body);

          for (const ev of events) {
            const chunk = `${JSON.stringify(ev)}\n`;
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        } catch (err: unknown) {
          const errEvent: DraftEvent = {
            type: 'error',
            error: {
              code: 'INTERNAL',
              message: err instanceof Error ? err.message : String(err),
              retryable: true,
              requestId: ctx.requestId,
            },
          };
          controller.enqueue(encoder.encode(`${JSON.stringify(errEvent)}\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache, no-transform',
        'X-Request-Id': ctx.requestId,
      },
    });
  },
});
