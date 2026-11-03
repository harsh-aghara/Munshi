/**
 * Base HTTP client for Sarvam AI APIs (BE-1).
 * Features:
 * - Timeouts via AbortController
 * - Exponential backoff retry on 429 and 5xx
 * - Unified error normalization to AppError
 * - Never logs request payload or response data
 */
import { AppError } from '../errors';

const SARVAM_BASE_URL = 'https://api.sarvam.ai';
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 500;

export interface SarvamRequestOptions {
  timeoutMs?: number;
  retries?: number;
  signal?: AbortSignal;
}

function getApiKey(): string {
  const key = process.env.SARVAM_API_KEY;
  if (!key) {
    throw new AppError(
      'INTERNAL',
      'Missing SARVAM_API_KEY environment variable.',
    );
  }
  return key;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sarvamFetch<T = unknown>(
  endpoint: string,
  init: RequestInit,
  options: SarvamRequestOptions = {},
): Promise<T> {
  const apiKey = getApiKey();
  const url = endpoint.startsWith('http') ? endpoint : `${SARVAM_BASE_URL}${endpoint}`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options.retries ?? MAX_RETRIES;

  let attempt = 0;
  let backoffMs = INITIAL_BACKOFF_MS;

  while (true) {
    attempt++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Merge external abort signal if provided
    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const headers = new Headers(init.headers || {});
      headers.set('api-subscription-key', apiKey);

      const res = await fetch(url, {
        ...init,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          return (await res.json()) as T;
        }
        return (await res.arrayBuffer()) as unknown as T;
      }

      // Retryable errors: 429 or 5xx
      const isRetryable = res.status === 429 || res.status >= 500;
      if (isRetryable && attempt <= maxRetries) {
        await sleep(backoffMs);
        backoffMs *= 2;
        continue;
      }

      let errorMsg = `Sarvam API returned HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson && typeof errJson === 'object') {
          errorMsg = errJson.message || errJson.error || JSON.stringify(errJson);
        }
      } catch {
        // Ignore json parse error on non-json error responses
      }

      if (res.status === 429) {
        throw new AppError('RATE_LIMITED', `Upstream rate limit reached: ${errorMsg}`);
      }
      throw new AppError('UPSTREAM_ERROR', `Sarvam error (${res.status}): ${errorMsg}`);
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      if (err instanceof AppError) {
        throw err;
      }

      if (err instanceof Error && err.name === 'AbortError') {
        if (attempt <= maxRetries) {
          await sleep(backoffMs);
          backoffMs *= 2;
          continue;
        }
        throw new AppError('UPSTREAM_TIMEOUT', `Sarvam API request timed out after ${timeoutMs}ms`);
      }

      if (attempt <= maxRetries) {
        await sleep(backoffMs);
        backoffMs *= 2;
        continue;
      }

      throw new AppError(
        'UPSTREAM_ERROR',
        `Network error communicating with Sarvam: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
