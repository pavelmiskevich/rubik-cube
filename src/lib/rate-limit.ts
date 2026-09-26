import { headers } from "next/headers";

/**
 * Best-effort, in-process rate limiter.
 *
 * Counters live in the memory of a single Node process, so they reset on
 * restart and are not shared between instances. It is enough to blunt
 * credential stuffing against a single-container deployment; a multi-instance
 * setup needs a shared store (Redis) instead.
 */
type Bucket = { count: number; expiresAt: number };

/*
  One map per process, not per module instance. Next bundles route handlers
  and page server actions into separate layers, each with its own copy of this
  module: a map in module scope gave the login endpoint and the login form two
  independent counters, doubling an attacker's budget (#101). Unlike the Prisma
  client, this is kept on globalThis in production too — that is the point.
*/
const globalForRateLimit = globalThis as unknown as {
  rateLimitBuckets?: Map<string, Bucket>;
};
const buckets = (globalForRateLimit.rateLimitBuckets ??= new Map<string, Bucket>());

/**
 * Soft cap: past it, a new key first sweeps out expired windows. Live
 * windows are never evicted — otherwise a flood of junk keys would lift a
 * block — so under such a flood the map still grows (TECHDEBT, rate limiter).
 */
const MAX_BUCKETS = 10_000;

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.expiresAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = { allowed: boolean; retryAfterMs: number };

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.expiresAt <= now) {
    if (buckets.size >= MAX_BUCKETS) sweep(now);
    buckets.set(key, { count: 1, expiresAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterMs: bucket.expiresAt - now };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

/*
  The three calls below split rateLimit() in two, for limits that count only
  failures: check before the attempt without spending it, record the failure
  after. A success then costs nothing, and can clear its own counter.
*/

/** Whether `key` has used up `limit` failures in its current window. Spends nothing. */
export function checkLimit(key: string, { limit }: { limit: number }): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.expiresAt <= now || bucket.count < limit) {
    return { allowed: true, retryAfterMs: 0 };
  }
  return { allowed: false, retryAfterMs: bucket.expiresAt - now };
}

/** Count one failure against `key`; the window opens with the first one. */
export function recordFailure(key: string, { windowMs }: { windowMs: number }): void {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.expiresAt <= now) {
    if (buckets.size >= MAX_BUCKETS) sweep(now);
    buckets.set(key, { count: 1, expiresAt: now + windowMs });
    return;
  }
  bucket.count += 1;
}

/** Forget `key`'s failures — after a success that proves the caller legitimate. */
export function resetLimit(key: string): void {
  buckets.delete(key);
}

/**
 * Caller IP as reported by the reverse proxy.
 *
 * `x-forwarded-for` is a comma-separated chain (`client, proxy1, proxy2`), so
 * only the left-most entry is the original client. The header is trivially
 * spoofable when the app is exposed directly — it is only trustworthy because
 * Caddy rewrites it in front of the app.
 */
export async function getClientIp(): Promise<string> {
  const headerList = await headers();

  const forwarded = headerList.get("x-forwarded-for");
  const client = forwarded?.split(",")[0]?.trim();
  if (client) return client;

  return headerList.get("x-real-ip")?.trim() || "unknown";
}
