/**
 * In-memory per-key rate limiter. Single-instance only — if HaiWeb scales
 * horizontally beyond one Cloud Run instance, replace with Upstash or a
 * similar shared store. For current single-instance dev + production
 * deployments it's sufficient to stop trivial scripted abuse.
 *
 * Algorithm: sliding window over `windowMs` with `max` allowed hits.
 * Entries are GC'd on each check so the map cannot grow unbounded.
 */

interface Bucket {
  hits: number[];
}

export interface RateLimiter {
  check(key: string): { allowed: boolean; retryAfterSeconds: number };
}

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
}): RateLimiter {
  const buckets = new Map<string, Bucket>();
  const { windowMs, max } = options;

  return {
    check(key: string) {
      const now = Date.now();
      const cutoff = now - windowMs;
      const bucket = buckets.get(key) ?? { hits: [] };
      bucket.hits = bucket.hits.filter((t) => t > cutoff);

      if (bucket.hits.length >= max) {
        const oldest = bucket.hits[0];
        const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
        buckets.set(key, bucket);
        return { allowed: false, retryAfterSeconds };
      }

      bucket.hits.push(now);
      buckets.set(key, bucket);

      // Opportunistic GC: drop buckets with no recent hits when the map
      // gets large. Bounds memory in pathological bot-traffic scenarios.
      if (buckets.size > 10_000) {
        for (const [k, b] of buckets) {
          if (b.hits.length === 0 || b.hits[b.hits.length - 1] < cutoff) {
            buckets.delete(k);
          }
        }
      }

      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}

/** Extract the client IP, preferring X-Forwarded-For from a trusted proxy. */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
