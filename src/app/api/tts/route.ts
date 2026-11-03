/**
 * Text to Speech route (BE-16).
 * Model: Bulbul v3.
 * Returns array of base64 audio WAV chunks for sequential playback.
 */
import { apiHandler } from '@/server/middleware';
import { TtsRequestSchema } from '@/contracts';
import { synthesizeSpeech } from '@/server/sarvam/tts';

export const runtime = 'nodejs';
export const maxDuration = 45;

export const POST = apiHandler({
  schema: TtsRequestSchema,
  handler: async (body) => {
    const { audios } = await synthesizeSpeech({
      text: body.text,
      lang: body.lang,
    });
    return Response.json({ audios });
  },
});
