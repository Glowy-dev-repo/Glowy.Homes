import { fail } from "./respond";

// In memory token bucket per IP (docs/02 section 5): 60 requests a minute on public routes.
// Per instance only; Phase 5 moves this to a shared store.

type Bucket = { tokens: number; updated: number };

export function createRateLimiter(perMinute: number, now: () => number = Date.now) {
  const buckets = new Map<string, Bucket>();
  const refillPerMs = perMinute / 60_000;

  return function take(key: string): boolean {
    const t = now();
    const b = buckets.get(key) ?? { tokens: perMinute, updated: t };
    b.tokens = Math.min(perMinute, b.tokens + (t - b.updated) * refillPerMs);
    b.updated = t;
    if (buckets.size > 10_000) buckets.clear();
    if (b.tokens < 1) {
      buckets.set(key, b);
      return false;
    }
    b.tokens -= 1;
    buckets.set(key, b);
    return true;
  };
}

const limiter = createRateLimiter(Number(process.env.RATE_LIMIT_PER_MINUTE ?? 60));

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

/** Returns a 429 response when the caller is over the limit, otherwise null. */
export function rateLimit(req: Request) {
  if (limiter(clientIp(req))) return null;
  return fail(429, { code: "rate_limited", message: "Too many requests. Wait a moment and try again." });
}
