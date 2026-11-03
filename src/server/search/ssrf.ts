/**
 * SSRF-safe fetcher and IP validator (BE-17, PRD Section 9, PRD Section 12).
 * - Public IPs only (checked after DNS resolution and for every redirect)
 * - Blocks RFC 1918 private ranges, loopback, link-local, cloud metadata
 * - http / https only
 * - Capped redirects, payload size, and timeout
 * - Text/HTML responses only
 */
import dns from 'node:dns/promises';
import { isIP } from 'node:net';
import { AppError } from '../errors';

const MAX_FETCH_SIZE_BYTES = 512 * 1024; // 512 KB
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 6000; // 6s

/**
 * Checks whether an IPv4 or IPv6 address is private, loopback, link-local, or reserved.
 */
export function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 0) return true; // Invalid IP format is treated as unsafe

  if (version === 4) {
    const parts = ip.split('.').map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return true;
    }
    const [a, b] = parts;

    // 0.0.0.0/8 (Current network)
    if (a === 0) return true;
    // 10.0.0.0/8 (Private)
    if (a === 10) return true;
    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;
    // 169.254.0.0/16 (Link-local, AWS/GCP/Azure metadata 169.254.169.254)
    if (a === 169 && b === 254) return true;
    // 172.16.0.0/12 (Private: 172.16.0.0 - 172.31.255.255)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (a === 192 && b === 168) return true;
    // 100.64.0.0/10 (Carrier-grade NAT)
    if (a === 100 && b >= 64 && b <= 127) return true;
    // 192.0.0.0/24, 192.0.2.0/24 (Documentation/Test-Net-1)
    if (a === 192 && b === 0) return true;
    // 198.51.100.0/24 (Test-Net-2)
    if (a === 198 && b === 51) return true;
    // 203.0.113.0/24 (Test-Net-3)
    if (a === 203 && b === 0) return true;
    // 224.0.0.0/4 (Multicast)
    if (a >= 224) return true;

    return false;
  }

  if (version === 6) {
    const normalized = ip.toLowerCase();
    // ::1 (Loopback)
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
    // :: (Unspecified)
    if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;
    // fc00::/7 (Unique Local Address - ULA)
    if (/^f[cd][0-9a-f]{2}:/i.test(normalized)) return true;
    // fe80::/10 (Link-Local)
    if (/^fe[89ab][0-9a-f]:/i.test(normalized)) return true;
    // IPv4-mapped IPv6 (::ffff:192.168.1.1)
    const v4Mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (v4Mapped) {
      return isPrivateIp(v4Mapped[1]);
    }
  }

  return false;
}

/**
 * Validates a URL and ensures its hostname resolves strictly to public IP addresses.
 */
export async function validateSafeUrl(urlString: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new AppError('VALIDATION_FAILED', `Invalid URL format: ${urlString}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppError(
      'VALIDATION_FAILED',
      `Forbidden URL protocol: ${parsed.protocol}. Only http and https are permitted.`,
    );
  }

  const hostname = parsed.hostname;

  // Direct IP check
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new AppError(
        'VALIDATION_FAILED',
        `Access to private IP address is forbidden: ${hostname}`,
      );
    }
    return parsed.toString();
  }

  // Resolve DNS to verify IP addresses
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    for (const record of addresses) {
      if (isPrivateIp(record.address)) {
        throw new AppError(
          'VALIDATION_FAILED',
          `Host ${hostname} resolves to private IP: ${record.address}`,
        );
      }
    }
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      'VALIDATION_FAILED',
      `DNS lookup failed for host ${hostname}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return parsed.toString();
}

/**
 * Fetches a web page safely with SSRF protections, redirect limits, and response size caps.
 * Returns raw text content.
 */
export async function ssrfSafeFetch(
  urlString: string,
  redirectCount = 0,
): Promise<string> {
  if (redirectCount > MAX_REDIRECTS) {
    throw new AppError('UPSTREAM_ERROR', 'Exceeded maximum allowable redirects.');
  }

  const safeUrl = await validateSafeUrl(urlString);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(safeUrl, {
      redirect: 'manual', // Manual redirect inspection to check each target IP
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html, text/plain, */*',
      },
    });

    clearTimeout(timer);

    // Follow redirect safely
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) {
        throw new AppError('UPSTREAM_ERROR', 'Redirect missing Location header.');
      }
      const nextUrl = new URL(location, safeUrl).toString();
      return ssrfSafeFetch(nextUrl, redirectCount + 1);
    }

    if (!res.ok) {
      throw new AppError(
        'UPSTREAM_ERROR',
        `Failed to fetch page (${res.status}): ${res.statusText}`,
      );
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      throw new AppError(
        'VALIDATION_FAILED',
        `Non-text content-type encountered: ${contentType}`,
      );
    }

    // Read with size cap
    const reader = res.body?.getReader();
    if (!reader) {
      return await res.text();
    }

    const chunks: Uint8Array[] = [];
    let bytesRead = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        bytesRead += value.length;
        if (bytesRead > MAX_FETCH_SIZE_BYTES) {
          reader.cancel();
          break; // Stop reading once size limit reached
        }
        chunks.push(value);
      }
    }

    const decoder = new TextDecoder('utf-8');
    const totalBytes = chunks.reduce((acc, c) => acc + c.length, 0);
    const combined = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    return decoder.decode(combined);
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof AppError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AppError('UPSTREAM_TIMEOUT', `Fetch timed out for ${urlString}`);
    }
    throw new AppError(
      'UPSTREAM_ERROR',
      `SSRF fetch error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
