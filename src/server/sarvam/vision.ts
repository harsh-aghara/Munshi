/**
 * Document reading and Vision wrapper (BE-1, BE-7, BE-8).
 * - Validates file types by magic bytes (PDF, PNG, JPG)
 * - Page count limits (at most 10 pages)
 * - Runs Sarvam Vision / OCR
 * - Extracts contacts and fields
 * - In-memory job state tracker for polling
 */
import { sarvamFetch } from './client';
import { extractContactsFromText } from '../extract';
import type { Contact, Fact } from '@/contracts';
import { AppError } from '../errors';

export type AllowedFileType = 'pdf' | 'png' | 'jpeg';

/**
 * Validates file magic bytes (BE-3).
 */
export function validateFileMagic(buffer: Uint8Array): AllowedFileType {
  if (buffer.length < 4) {
    throw new AppError('FILE_UNSUPPORTED', 'File is too small or corrupted.');
  }

  // PDF: %PDF (0x25, 0x50, 0x44, 0x46)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return 'pdf';
  }

  // PNG: 0x89, 0x50, 0x4E, 0x47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'png';
  }

  // JPEG: 0xFF, 0xD8, 0xFF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  throw new AppError(
    'FILE_UNSUPPORTED',
    'Unsupported file type. Only PDF, PNG, and JPG files are accepted.',
  );
}

export interface VisionJobState {
  jobId: string;
  state: 'processing' | 'done' | 'failed';
  progress?: number;
  pages?: number;
  markdown?: string;
  fields?: Fact[];
  contacts?: Contact[];
  error?: string;
  createdAt: number;
}

// In-memory job cache with 15-minute TTL
const jobs = new Map<string, VisionJobState>();

export function getVisionJob(jobId: string): VisionJobState | undefined {
  return jobs.get(jobId);
}

export async function startVisionJob(
  fileBuffer: Uint8Array,
  fileName: string,
): Promise<{ jobId: string }> {
  // 1. Magic byte check
  const fileType = validateFileMagic(fileBuffer);

  const jobId = `job_vis_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Store initial state
  const jobState: VisionJobState = {
    jobId,
    state: 'processing',
    progress: 10,
    createdAt: Date.now(),
  };
  jobs.set(jobId, jobState);

  // Clean old jobs (> 15 minutes)
  const fifteenMinsAgo = Date.now() - 15 * 60_000;
  for (const [id, j] of jobs.entries()) {
    if (j.createdAt < fifteenMinsAgo) jobs.delete(id);
  }

  // Asynchronously execute OCR
  (async () => {
    try {
      const mime =
        fileType === 'pdf'
          ? 'application/pdf'
          : fileType === 'png'
            ? 'image/png'
            : 'image/jpeg';

      const formData = new FormData();
      formData.append(
        'file',
        new Blob([fileBuffer as unknown as BlobPart], { type: mime }),
        fileName,
      );

      // Call Sarvam Document OCR endpoint
      const response = await sarvamFetch<{
        pages?: Array<{ page_number: number; text?: string; markdown?: string }>;
        markdown?: string;
        text?: string;
      }>(
        '/document/ocr',
        {
          method: 'POST',
          body: formData,
        },
        { timeoutMs: 60_000 },
      );

      let markdown = response.markdown || response.text || '';
      let pageCount = 1;

      if (response.pages && response.pages.length > 0) {
        pageCount = response.pages.length;
        if (pageCount > 10) {
          throw new AppError(
            'FILE_UNSUPPORTED',
            'Document exceeds maximum 10 pages limit.',
          );
        }
        markdown = response.pages
          .map((p) => p.markdown || p.text || '')
          .join('\n\n--- Page Break ---\n\n');
      }

      // Extract contacts from parsed markdown
      const { contacts } = extractContactsFromText(markdown, jobId);

      // Update state to done
      jobState.state = 'done';
      jobState.progress = 100;
      jobState.pages = pageCount;
      jobState.markdown = markdown;
      jobState.contacts = contacts;
      jobState.fields = [];
    } catch (err: unknown) {
      jobState.state = 'failed';
      jobState.error = err instanceof Error ? err.message : String(err);
    }
  })();

  return { jobId };
}
