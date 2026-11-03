/**
 * Rate limiter with in-memory and Upstash Redis backends (BE-3).
 * Tracks per-IP: request count, Vision pages, STT minutes, lookups.
 */

interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<number>;
  get(key: string): Promise<number>;
}

// In-memory store for development (no Redis needed)
class MemoryStore implements RateLimitStore {
  private buckets = new Map<string, { count: number; expiresAt: number }>();

  async increment(key: string, windowMs: number): Promise<number> {
    const now = Date.now();
    const existing = this.buckets.get(key);
    if (!existing || existing.expiresAt <= now) {
      this.buckets.set(key, { count: 1, expiresAt: now + windowMs });
      return 1;
    }
    existing.count++;
    return existing.count;
  }

  async get(key: string): Promise<number> {
    const existing = this.buckets.get(key);
    if (!existing || existing.expiresAt <= Date.now()) return 0;
    return existing.count;
  }
}

// Upstash Redis store for production
class UpstashStore implements RateLimitStore {
  private url: string;
  private token: string;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  private async command(args: string[]): Promise<unknown> {
    const res = await fetch(`${this.url}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(`Upstash error: ${res.status}`);
    const data = await res.json();
    return data.result;
  }

  async increment(key: string, windowMs: number): Promise<number> {
    const ttlSeconds = Math.ceil(windowMs / 1000);
    const count = (await this.command(['INCR', key])) as number;
    if (count === 1) {
      await this.command(['EXPIRE', key, String(ttlSeconds)]);
    }
    return count;
  }

  async get(key: string): Promise<number> {
    const val = (await this.command(['GET', key])) as string | null;
    return val ? parseInt(val, 10) : 0;
  }
}

// Limits per IP per day
export const LIMITS = {
  requestsPerMinute: 30,
  visionPagesPerDay: 50,
  sttMinutesPerDay: 30,
  lookupsPerDay: 20,
} as const;

let store: RateLimitStore | null = null;

function getStore(): RateLimitStore {
  if (store) return store;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    store = new UpstashStore(url, token);
  } else {
    store = new MemoryStore();
  }
  return store;
}

const MINUTE = 60_000;
const DAY = 86_400_000;

export async function checkRateLimit(ip: string): Promise<boolean> {
  const s = getStore();
  const key = `rl:rpm:${ip}`;
  const count = await s.increment(key, MINUTE);
  return count <= LIMITS.requestsPerMinute;
}

export async function checkDailyLimit(
  ip: string,
  resource: 'vision' | 'stt' | 'lookups',
  amount: number = 1,
): Promise<boolean> {
  const s = getStore();
  const dateKey = new Date().toISOString().slice(0, 10);
  const key = `rl:${resource}:${ip}:${dateKey}`;

  const limitMap = {
    vision: LIMITS.visionPagesPerDay,
    stt: LIMITS.sttMinutesPerDay,
    lookups: LIMITS.lookupsPerDay,
  };

  const current = await s.get(key);
  if (current + amount > limitMap[resource]) return false;

  // Increment by amount
  for (let i = 0; i < amount; i++) {
    await s.increment(key, DAY);
  }
  return true;
}
