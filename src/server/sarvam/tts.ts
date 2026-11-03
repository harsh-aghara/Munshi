/**
 * Typed Sarvam TTS wrapper (BE-1, BE-16).
 * Model: Bulbul v3.
 * Chunks text to stay within upstream limits and returns combined or chunked audio.
 */
import { sarvamFetch } from './client';
import { getLanguage } from '@/config/languages';
import { AppError } from '../errors';

const BULBUL_CHAR_LIMIT = 500;

export interface SarvamTtsResponse {
  audios: string[]; // Base64-encoded audio WAV chunks
}

export interface TtsOptions {
  text: string;
  lang: string;
  voice?: string;
}

/**
 * Splits long text into chunks at sentence boundaries under the character limit.
 */
export function chunkTextForTts(text: string, limit = BULBUL_CHAR_LIMIT): string[] {
  const sentences = text.split(/(?<=[.?!।|\n])/);
  const chunks: string[] = [];
  let current = '';

  for (const s of sentences) {
    if (!s.trim()) continue;
    if (current.length + s.length > limit) {
      if (current.trim()) chunks.push(current.trim());
      // If a single sentence exceeds the limit, split by words
      if (s.length > limit) {
        const words = s.split(/\s+/);
        let sub = '';
        for (const w of words) {
          if (sub.length + w.length + 1 > limit) {
            if (sub.trim()) chunks.push(sub.trim());
            sub = w;
          } else {
            sub = sub ? `${sub} ${w}` : w;
          }
        }
        current = sub;
      } else {
        current = s;
      }
    } else {
      current = current ? `${current} ${s}` : s;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.length > 0 ? chunks : [text.slice(0, limit)];
}

export const BULBUL_SPEAKERS = new Set([
  'aditya', 'ritu', 'ashutosh', 'priya', 'neha', 'rahul', 'pooja', 'rohan',
  'simran', 'kavya', 'amit', 'dev', 'ishita', 'shreya', 'ratan', 'varun',
  'manan', 'sumit', 'roopa', 'kabir', 'aayan', 'shubh', 'advait', 'anand',
  'tanya', 'tarun', 'sunny', 'mani', 'gokul', 'vijay', 'shruti', 'suhani',
  'mohit', 'kavitha', 'rehan', 'soham', 'rupali',
]);

export async function synthesizeSpeech(
  options: TtsOptions,
): Promise<{ audios: string[] }> {
  const { text, lang, voice } = options;

  const langDef = getLanguage(lang);
  if (!langDef || !langDef.tts) {
    throw new AppError(
      'UNSUPPORTED_LANGUAGE',
      `Language '${lang}' is not supported for text-to-speech.`,
    );
  }

  const chunks = chunkTextForTts(text);
  const rawSpeaker = (voice || langDef.ttsVoice || 'ritu').toLowerCase();
  const speaker = BULBUL_SPEAKERS.has(rawSpeaker) ? rawSpeaker : 'ritu';

  // Request TTS for all chunks
  const response = await sarvamFetch<SarvamTtsResponse>(
    '/text-to-speech',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: chunks,
        target_language_code: lang,
        speaker,
        model: 'bulbul:v3',
      }),
    },
    { timeoutMs: 30_000 },
  );

  return { audios: response.audios || [] };
}
