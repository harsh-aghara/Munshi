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
import zlib from 'node:zlib';

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

/**
 * Helper to extract markdown files from Sarvam Doc AI zip output in memory without external dependencies.
 */
function parseZipInMem(buf: Buffer): Record<string, string> {
  const files: Record<string, string> = {};
  const eocdSig = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const eocdOffset = buf.lastIndexOf(eocdSig);
  if (eocdOffset === -1) return files;

  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const totalEntries = buf.readUInt16LE(eocdOffset + 10);

  let cur = cdOffset;
  for (let i = 0; i < totalEntries && cur < buf.length - 46; i++) {
    if (buf.readUInt32LE(cur) !== 0x02014b50) break;
    const method = buf.readUInt16LE(cur + 10);
    const compSize = buf.readUInt32LE(cur + 20);
    const nameLen = buf.readUInt16LE(cur + 28);
    const extraLen = buf.readUInt16LE(cur + 30);
    const commentLen = buf.readUInt16LE(cur + 32);
    const localHeaderOffset = buf.readUInt32LE(cur + 42);

    const name = buf.subarray(cur + 46, cur + 46 + nameLen).toString('utf-8');

    if (localHeaderOffset + 30 <= buf.length) {
      const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
      const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localNameLen + localExtraLen;

      if (dataOffset + compSize <= buf.length) {
        const compData = buf.subarray(dataOffset, dataOffset + compSize);
        if (method === 0) {
          files[name] = compData.toString('utf-8');
        } else if (method === 8) {
          try {
            files[name] = zlib.inflateRawSync(compData).toString('utf-8');
          } catch {}
        }
      }
    }

    cur += 46 + nameLen + extraLen + commentLen;
  }
  return files;
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

  // Asynchronously execute Sarvam Document AI pipeline
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
      formData.append('output_format', 'md');
      formData.append('language', 'en-IN');

      // 1. Submit Doc AI parsing job
      const startRes = await sarvamFetch<{ job_id: string }>(
        '/doc-ai/v1/job/parse',
        {
          method: 'POST',
          body: formData,
        },
        { timeoutMs: 30_000 },
      );

      const sarvamJobId = startRes.job_id;
      if (!sarvamJobId) {
        throw new Error('Sarvam Doc AI did not return a job_id');
      }

      // 2. Poll Sarvam for completion
      const pollStartTime = Date.now();
      let statusData: { status: string; usage?: { pages_total?: number } } | null = null;

      while (Date.now() - pollStartTime < 60_000) {
        await new Promise((r) => setTimeout(r, 2000));
        const res = await sarvamFetch<{ status: string; usage?: { pages_total?: number } }>(
          `/doc-ai/v1/job/${sarvamJobId}/status`,
          { method: 'GET' },
          { timeoutMs: 15_000 },
        );

        const elapsed = Date.now() - pollStartTime;
        jobState.progress = Math.min(85, Math.round(20 + (elapsed / 60_000) * 65));

        if (res.status === 'completed' || res.status === 'partially_completed') {
          statusData = res;
          break;
        } else if (res.status === 'failed' || res.status === 'rejected') {
          throw new Error(`Sarvam Document AI job failed with status: ${res.status}`);
        }
      }

      if (!statusData) {
        throw new Error('Document processing timed out after 60 seconds.');
      }

      // 3. Get download URL
      const dlRes = await sarvamFetch<{ url: string }>(
        `/doc-ai/v1/job/${sarvamJobId}/download-url`,
        { method: 'GET' },
        { timeoutMs: 15_000 },
      );

      if (!dlRes.url) {
        throw new Error('Sarvam did not return a document download URL.');
      }

      // 4. Download and unpack parsed markdown
      const fileRes = await fetch(dlRes.url);
      if (!fileRes.ok) {
        throw new Error(`Failed to download parsed document: HTTP ${fileRes.status}`);
      }

      const fileBuf = Buffer.from(await fileRes.arrayBuffer());
      let markdown = '';

      if (fileBuf.length > 4 && fileBuf.readUInt32LE(0) === 0x04034b50) {
        const extracted = parseZipInMem(fileBuf);
        const mdEntry = Object.entries(extracted).find(([name]) => name.endsWith('.md'));
        markdown = mdEntry ? mdEntry[1] : '';
      } else {
        markdown = fileBuf.toString('utf-8');
      }

      const pageCount = statusData.usage?.pages_total || 1;
      if (pageCount > 10) {
        throw new AppError('FILE_UNSUPPORTED', 'Document exceeds maximum 10 pages limit.');
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
