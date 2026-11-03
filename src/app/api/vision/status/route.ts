/**
 * Vision status polling route (BE-7).
 * Returns state, progress, markdown per page, extracted fields and contacts.
 */
import { getVisionJob } from '@/server/sarvam/vision';
import { AppError, errorResponse } from '@/server/errors';
import { timingSafeEqual } from 'crypto';

export const runtime = 'nodejs';

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return timingSafeEqual(bufA, bufB);
}

export async function GET(req: Request) {
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();

  try {
    // Access code check
    const accessCode = process.env.ACCESS_CODE;
    if (!accessCode) {
      throw new AppError('INTERNAL', 'Server misconfigured: ACCESS_CODE not set.');
    }
    const provided = req.headers.get('x-access-code') || '';
    if (!constantTimeCompare(provided, accessCode)) {
      throw new AppError('ACCESS_DENIED', 'Invalid or missing access code.');
    }

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      throw new AppError('VALIDATION_FAILED', "Missing 'jobId' query parameter.");
    }

    const job = getVisionJob(jobId);
    if (!job) {
      throw new AppError('VALIDATION_FAILED', `No job found with ID: ${jobId}`);
    }

    return Response.json({
      state: job.state,
      progress: job.progress,
      pages: job.pages,
      markdown: job.markdown,
      fields: job.fields,
      contacts: job.contacts,
      error: job.error,
    });
  } catch (err: unknown) {
    return errorResponse(err, requestId);
  }
}
