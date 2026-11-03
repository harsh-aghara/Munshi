/**
 * Speech to Text route (BE-6).
 * Accepts FormData with audio blob and lang code (or 'auto').
 * Returns timestamped Segment[].
 */
import { formDataHandler } from '@/server/middleware';
import { transcribeAudio } from '@/server/sarvam/stt';
import { checkDailyLimit } from '@/server/rate-limit';
import { AppError } from '@/server/errors';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60s max execution

export const POST = formDataHandler(async (formData, ctx) => {
  const audioFile = formData.get('audio') as Blob | null;
  const lang = (formData.get('lang') as string | null) || 'auto';

  if (!audioFile) {
    throw new AppError(
      'VALIDATION_FAILED',
      "Missing 'audio' field in form data.",
    );
  }

  // Handle empty or micro-click recordings gracefully
  if (audioFile.size < 500) {
    return Response.json({ segments: [] });
  }

  // Audio size cap (max 25MB)
  if (audioFile.size > 25 * 1024 * 1024) {
    throw new AppError(
      'FILE_UNSUPPORTED',
      'Audio file size exceeds maximum limit of 25MB.',
    );
  }

  // Check daily STT limit
  const approxMinutes = Math.max(1, Math.ceil(audioFile.size / (1024 * 1024)));
  const allowed = await checkDailyLimit(ctx.ip, 'stt', approxMinutes);
  if (!allowed) {
    throw new AppError(
      'RATE_LIMITED',
      'Daily speech-to-text usage limit reached for this IP.',
    );
  }

  const { segments } = await transcribeAudio({
    audioBlob: audioFile,
    lang,
  });

  return Response.json({ segments });
});
