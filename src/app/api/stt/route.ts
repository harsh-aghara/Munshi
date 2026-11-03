/**
 * Speech to Text route (BE-6).
 * Accepts FormData with audio blob and lang code (or 'auto').
 * Returns timestamped Segment[].
 */
import { formDataHandler } from '@/server/middleware';
import { transcribeAudio } from '@/server/sarvam/stt';
import { AppError } from '@/server/errors';

export const runtime = 'nodejs';
export const maxDuration = 300; // 300s max execution for long audio transcription

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

  const { segments } = await transcribeAudio({
    audioBlob: audioFile,
    lang,
  });

  return Response.json({ segments });
});
