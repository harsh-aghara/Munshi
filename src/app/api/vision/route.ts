/**
 * Document Vision upload route (BE-7).
 * Validates file and starts asynchronous reading job, returning jobId.
 */
import { formDataHandler } from '@/server/middleware';
import { startVisionJob } from '@/server/sarvam/vision';
import { checkDailyLimit } from '@/server/rate-limit';
import { AppError } from '@/server/errors';

export const runtime = 'nodejs';
export const maxDuration = 60;

export const POST = formDataHandler(async (formData, ctx) => {
  const file = formData.get('file') as File | null;
  if (!file) {
    throw new AppError(
      'VALIDATION_FAILED',
      "Missing 'file' field in form data.",
    );
  }

  // File size limit: 20MB
  if (file.size > 20 * 1024 * 1024) {
    throw new AppError(
      'FILE_UNSUPPORTED',
      'File size exceeds 20MB limit.',
    );
  }

  // Check daily page cap
  const allowed = await checkDailyLimit(ctx.ip, 'vision', 1);
  if (!allowed) {
    throw new AppError(
      'RATE_LIMITED',
      'Daily document vision processing limit reached for this IP.',
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);

  const { jobId } = await startVisionJob(uint8, file.name);

  return Response.json({ jobId });
});
