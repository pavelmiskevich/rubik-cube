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

const buckets = new Map<string, Bucket>();

/** Hard cap so a flood of unique keys cannot grow the map without bound. */
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
