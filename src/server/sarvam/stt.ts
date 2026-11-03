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
    words?: string[] | Array<{
      word: string;
      start_time_seconds?: number;
      end_time_seconds?: number;
    }>;
    start_time_seconds?: number[];
    end_time_seconds?: number[];
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

  // Sarvam strictly validates MIME types against an exact string whitelist without codec parameters.
  // Browsers often report 'audio/webm;codecs=opus', which Sarvam rejects if ';codecs=...' is present.
  let cleanType = (audioBlob.type || 'audio/webm').split(';')[0].trim().toLowerCase();
  const ALLOWED_SARVAM_AUDIO_TYPES = new Set([
    'audio/mpeg',
    'audio/mp3',
    'audio/mpeg3',
    'audio/x-mpeg-3',
    'audio/x-mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/pcm_s16le',
    'audio/l16',
    'audio/raw',
    'application/octet-stream',
    'audio/aac',
    'audio/x-aac',
    'audio/aiff',
    'audio/x-aiff',
    'audio/ogg',
    'audio/opus',
    'audio/flac',
    'audio/x-flac',
    'audio/mp4',
    'audio/x-m4a',
    'audio/amr',
    'audio/x-ms-wma',
    'audio/webm',
    'video/webm',
  ]);
  if (!ALLOWED_SARVAM_AUDIO_TYPES.has(cleanType)) {
    cleanType = 'audio/webm';
  }

  const ext = cleanType.includes('wav')
    ? 'wav'
    : cleanType.includes('mp4') || cleanType.includes('m4a')
    ? 'mp4'
    : cleanType.includes('ogg') || cleanType.includes('opus')
    ? 'ogg'
    : cleanType.includes('mp3') || cleanType.includes('mpeg')
    ? 'mp3'
    : 'webm';

  const audioBuffer = await audioBlob.arrayBuffer();
  const normalizedBlob = new Blob([audioBuffer], { type: cleanType });

  const formData = new FormData();
  formData.append('file', normalizedBlob, `audio.${ext}`);
  formData.append('model', model);
  formData.append('language_code', langCode);
  formData.append('mode', mode);
  formData.append('with_timestamps', 'true');

  try {
    const result = await sarvamFetch<SarvamSttResponse>(
      '/speech-to-text',
      {
        method: 'POST',
        body: formData,
      },
      { timeoutMs: 45_000 },
    );
    return parseSarvamSttResult(result, lang);
  } catch (err: any) {
    // If Sarvam rejects due to audio exceeding 30s limit, automatically fall back to the batch API
    const isDurationLimit =
      err?.message?.includes('Audio duration exceeds') ||
      err?.message?.includes('30 seconds') ||
      err?.message?.includes('batch API');
    if (isDurationLimit) {
      return transcribeAudioBatch(options);
    }
    throw err;
  }
}

/**
 * Parses raw Sarvam STT response into standardized timestamped segments.
 */
export function parseSarvamSttResult(
  result: SarvamSttResponse,
  lang: string,
): { segments: Segment[]; detectedLang: string } {
  const detectedLang = result.language_code || (lang === 'auto' ? 'en-IN' : lang);
  const segments: Segment[] = [];

  // Sarvam saaras:v3 returns parallel arrays:
  // timestamps: { words: string[], start_time_seconds: number[], end_time_seconds: number[] }
  // We normalize to: WordItem[] = { word: string, startMs: number, endMs: number }
  interface WordItem {
    word: string;
    startMs: number;
    endMs: number;
  }

  const normalizedWords: WordItem[] = [];
  const rawWords = result.timestamps?.words;
  const startTimes = result.timestamps?.start_time_seconds;
  const endTimes = result.timestamps?.end_time_seconds;

  if (Array.isArray(rawWords) && rawWords.length > 0) {
    for (let i = 0; i < rawWords.length; i++) {
      const item = rawWords[i];
      if (typeof item === 'string') {
        // Parallel arrays structure
        const rawStart = Array.isArray(startTimes) ? startTimes[i] : undefined;
        const rawEnd = Array.isArray(endTimes) ? endTimes[i] : undefined;
        const s = typeof rawStart === 'number' && !isNaN(rawStart) ? Math.round(rawStart * 1000) : 0;
        const e = typeof rawEnd === 'number' && !isNaN(rawEnd) ? Math.round(rawEnd * 1000) : s;
        normalizedWords.push({ word: item, startMs: s, endMs: e });
      } else if (item && typeof item === 'object') {
        // Object structure
        const rawStart = (item as any).start_time_seconds;
        const rawEnd = (item as any).end_time_seconds;
        const s = typeof rawStart === 'number' && !isNaN(rawStart) ? Math.round(rawStart * 1000) : 0;
        const e = typeof rawEnd === 'number' && !isNaN(rawEnd) ? Math.round(rawEnd * 1000) : s;
        normalizedWords.push({ word: (item as any).word || '', startMs: s, endMs: e });
      }
    }
  }

  // If normalized words are present, group them into sentence-sized segments
  if (normalizedWords.length > 0) {
    let currentWords: string[] = [];
    let segStart = normalizedWords[0].startMs;
    let segEnd = segStart;

    for (let i = 0; i < normalizedWords.length; i++) {
      const w = normalizedWords[i];
      currentWords.push(w.word);
      segEnd = w.endMs;

      // Break on sentence terminators or when ~15 words accumulate
      const isTerminator = /[.?!।|]/.test(w.word);
      const isLongEnough = currentWords.length >= 15;
      const isLast = i === normalizedWords.length - 1;

      if (isTerminator || isLongEnough || isLast) {
        segments.push({
          id: `seg_${Date.now()}_${segments.length + 1}`,
          startMs: typeof segStart === 'number' && !isNaN(segStart) ? segStart : 0,
          endMs: typeof segEnd === 'number' && !isNaN(segEnd) ? segEnd : 0,
          text: currentWords.join(' ').trim(),
          lang: detectedLang,
        });
        currentWords = [];
        if (!isLast && normalizedWords[i + 1]) {
          segStart = normalizedWords[i + 1].startMs;
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

/**
 * Transcribes audio using Sarvam Batch STT API (up to 2 hours per file).
 * Used automatically when audio duration exceeds Sarvam's synchronous 30s limit.
 */
export async function transcribeAudioBatch(
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

  let cleanType = (audioBlob.type || 'audio/webm').split(';')[0].trim().toLowerCase();
  const ALLOWED_SARVAM_AUDIO_TYPES = new Set([
    'audio/mpeg',
    'audio/mp3',
    'audio/mpeg3',
    'audio/x-mpeg-3',
    'audio/x-mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/pcm_s16le',
    'audio/l16',
    'audio/raw',
    'application/octet-stream',
    'audio/aac',
    'audio/x-aac',
    'audio/aiff',
    'audio/x-aiff',
    'audio/ogg',
    'audio/opus',
    'audio/flac',
    'audio/x-flac',
    'audio/mp4',
    'audio/x-m4a',
    'audio/amr',
    'audio/x-ms-wma',
    'audio/webm',
    'video/webm',
  ]);
  if (!ALLOWED_SARVAM_AUDIO_TYPES.has(cleanType)) {
    cleanType = 'audio/webm';
  }

  const ext = cleanType.includes('wav')
    ? 'wav'
    : cleanType.includes('mp4') || cleanType.includes('m4a')
    ? 'mp4'
    : cleanType.includes('ogg') || cleanType.includes('opus')
    ? 'ogg'
    : cleanType.includes('mp3') || cleanType.includes('mpeg')
    ? 'mp3'
    : 'webm';

  const fileName = `audio.${ext}`;
  const audioBuffer = await audioBlob.arrayBuffer();

  // 1. Initiate batch job
  interface BatchInitResponse {
    job_id: string;
    job_state: string;
  }
  const job = await sarvamFetch<BatchInitResponse>(
    '/speech-to-text/job/v1',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_parameters: {
          model,
          mode,
          language_code: langCode,
          with_timestamps: true,
        },
      }),
    },
    { timeoutMs: 30_000 },
  );

  // 2. Request upload URLs
  interface BatchUploadResponse {
    job_id: string;
    upload_urls: Record<string, { file_url: string }>;
  }
  const uploadInfo = await sarvamFetch<BatchUploadResponse>(
    '/speech-to-text/job/v1/upload-files',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: job.job_id,
        files: [fileName],
      }),
    },
    { timeoutMs: 30_000 },
  );

  const fileUrl = uploadInfo.upload_urls?.[fileName]?.file_url;
  if (!fileUrl) {
    throw new AppError('UPSTREAM_ERROR', 'Failed to retrieve batch audio upload URL from Sarvam.');
  }

  // 3. Upload audio binary directly to storage
  const uploadRes = await fetch(fileUrl, {
    method: 'PUT',
    body: audioBuffer,
    headers: { 'Content-Type': cleanType },
  });
  if (!uploadRes.ok) {
    throw new AppError('UPSTREAM_ERROR', `Failed to upload audio to batch storage: HTTP ${uploadRes.status}`);
  }

  // 4. Start batch processing
  await sarvamFetch(
    `/speech-to-text/job/v1/${job.job_id}/start`,
    {
      method: 'POST',
    },
    { timeoutMs: 30_000 },
  );

  // 5. Poll status until complete or failed (poll every 1.5s, up to 40 times = 60s)
  interface BatchStatusResponse {
    job_id: string;
    job_state?: string;
    status?: string;
    error_message?: string;
    job_details?: Array<{
      inputs?: Array<{ file_name: string; file_id: string }>;
      outputs?: Array<{ file_name: string; file_id: string }>;
      state?: string;
      error_message?: string;
    }>;
  }

  let finalStatus: BatchStatusResponse | null = null;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const statusData = await sarvamFetch<BatchStatusResponse>(
      `/speech-to-text/job/v1/${job.job_id}/status`,
      { method: 'GET' },
      { timeoutMs: 15_000 },
    );
    const state = statusData.job_state || statusData.status;
    if (state === 'Completed') {
      finalStatus = statusData;
      break;
    }
    if (state === 'Failed' || state === 'Rejected') {
      const errMsg =
        statusData.error_message ||
        statusData.job_details?.[0]?.error_message ||
        'Batch transcription job failed.';
      throw new AppError('UPSTREAM_ERROR', `Sarvam batch job error: ${errMsg}`);
    }
  }

  if (!finalStatus) {
    throw new AppError('UPSTREAM_ERROR', 'Sarvam batch job timed out while waiting for transcription.');
  }

  // 6. Download the result JSON
  const outputFile = finalStatus.job_details?.[0]?.outputs?.[0]?.file_name || '0.json';
  interface BatchDownloadResponse {
    download_urls: Record<string, { file_url: string }>;
  }
  const downloadRes = await sarvamFetch<BatchDownloadResponse>(
    '/speech-to-text/job/v1/download-files',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: job.job_id,
        files: [outputFile],
      }),
    },
    { timeoutMs: 30_000 },
  );

  const downloadUrl = downloadRes.download_urls?.[outputFile]?.file_url;
  if (!downloadUrl) {
    throw new AppError('UPSTREAM_ERROR', 'Failed to retrieve transcription download URL from Sarvam batch job.');
  }

  const transcriptRes = await fetch(downloadUrl);
  if (!transcriptRes.ok) {
    throw new AppError('UPSTREAM_ERROR', `Failed to download transcript payload: HTTP ${transcriptRes.status}`);
  }

  const batchResult = (await transcriptRes.json()) as SarvamSttResponse;
  return parseSarvamSttResult(batchResult, lang);
}
