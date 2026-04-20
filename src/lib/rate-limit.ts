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

      // Opportunistic GC runs on every call (including the rate-limited
      // path) so long-blocked buckets don't accumulate unchecked. The sweep
      // only walks the map past 10k keys so normal traffic stays cheap.
      if (buckets.size > 10_000) {
        for (const [k, b] of buckets) {
          if (b.hits.length === 0 || b.hits[b.hits.length - 1] < cutoff) {
            buckets.delete(k);
          }
        }
      }

      if (bucket.hits.length >= max) {
        const oldest = bucket.hits[0];
        const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
        buckets.set(key, bucket);
        return { allowed: false, retryAfterSeconds };
      }

      bucket.hits.push(now);
      buckets.set(key, bucket);

      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}

/**
 * Extract the client IP from X-Forwarded-For, taking the RIGHTMOST entry.
 *
 * On Cloud Run the Google Front End appends the real client IP to the right
 * of any client-supplied header. Taking the leftmost value would use the
 * attacker-controlled string — a trivial spoof. The rightmost entry is the
 * one Google Frontend added and cannot be forged by the request originator.
 *
 * If HaiWeb is ever deployed behind a different proxy chain (e.g., direct
 * Kubernetes ingress with no IP-appending trusted proxy), revisit this.
 */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
