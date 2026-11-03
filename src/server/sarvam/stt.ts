/**
 * Typed Sarvam STT wrapper (BE-1, BE-6).
 * Handles audio transcription using Saaras model.
 * Returns timestamped Segment[].
 */
import { sarvamFetch } from './client';
import type { Segment } from '@/contracts';
import { getLanguage } from '@/config/languages';
import { AppError } from '../errors';

export interface SarvamSttResponse {
  transcript: string;
  language_code?: string;
  timestamps?: {
    words?: Array<{
      word: string;
      start_time_seconds: number;
      end_time_seconds: number;
    }>;
  };
}

export interface TranscribeAudioOptions {
  audioBlob: Blob;
  lang: string; // BCP-47 or 'auto'
}

export async function transcribeAudio(
  options: TranscribeAudioOptions,
): Promise<{ segments: Segment[]; detectedLang: string }> {
  const { audioBlob, lang } = options;

  if (lang !== 'auto' && !getLanguage(lang)) {
    throw new AppError(
      'UNSUPPORTED_LANGUAGE',
      `Language '${lang}' is not supported for transcription.`,
    );
  }

  const langDef = lang !== 'auto' ? getLanguage(lang) : undefined;
  const langCode = lang === 'auto' ? 'unknown' : lang;
  const model = 'saaras:v3';

  // Defensive mode mapping ensuring strictly valid Sarvam STT modes:
  // 'transcribe' | 'translate' | 'indic-en' | 'verbatim' | 'translit' | 'codemix'
  let rawMode: string = langDef?.sttMode || 'codemix';
  if (rawMode === 'code-mix') rawMode = 'codemix';
  if (rawMode === 'formal') rawMode = 'transcribe';
  const VALID_SARVAM_MODES = new Set([
    'transcribe',
    'translate',
    'indic-en',
    'verbatim',
    'translit',
    'codemix',
  ]);
  const mode = VALID_SARVAM_MODES.has(rawMode) ? rawMode : 'codemix';

  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('model', model);
  formData.append('language_code', langCode);
  formData.append('mode', mode);
  formData.append('with_timestamps', 'true');

  const result = await sarvamFetch<SarvamSttResponse>(
    '/speech-to-text',
    {
      method: 'POST',
      body: formData,
    },
    { timeoutMs: 45_000 },
  );

  const detectedLang = result.language_code || (lang === 'auto' ? 'en-IN' : lang);
  const segments: Segment[] = [];

  // If words with timestamps are present, we can group them into sentence-sized segments
  if (result.timestamps?.words && result.timestamps.words.length > 0) {
    const words = result.timestamps.words;
    let currentWords: string[] = [];
    let startMs = Math.round(words[0].start_time_seconds * 1000);
    let endMs = startMs;

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      currentWords.push(w.word);
      endMs = Math.round(w.end_time_seconds * 1000);

      // Break on sentence terminators or when ~15 words accumulate
      const isTerminator = /[.?!।|]/.test(w.word);
      const isLongEnough = currentWords.length >= 15;
      const isLast = i === words.length - 1;

      if (isTerminator || isLongEnough || isLast) {
        segments.push({
          id: `seg_${Date.now()}_${segments.length + 1}`,
          startMs,
          endMs,
          text: currentWords.join(' ').trim(),
          lang: detectedLang,
        });
        currentWords = [];
        if (!isLast && words[i + 1]) {
          startMs = Math.round(words[i + 1].start_time_seconds * 1000);
        }
      }
    }
  } else if (result.transcript && result.transcript.trim()) {
    // Single segment if no timestamps returned
    segments.push({
      id: `seg_${Date.now()}_1`,
      startMs: 0,
      endMs: 0,
      text: result.transcript.trim(),
      lang: detectedLang,
    });
  }

  return { segments, detectedLang };
}
