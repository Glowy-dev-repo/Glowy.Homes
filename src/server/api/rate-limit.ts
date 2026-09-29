import { fail } from "./respond";

// In memory token bucket per IP (docs/02 section 5): 60 requests a minute on public routes.
// Per instance only; Phase 5 moves this to a shared store.

type Bucket = { tokens: number; updated: number };

/** `burst` is the bucket size; it defaults to one minute of refill. */
export function createRateLimiter(perMinute: number, now: () => number = Date.now, burst: number = perMinute) {
  const buckets = new Map<string, Bucket>();
  const refillPerMs = perMinute / 60_000;

  return function take(key: string): boolean {
    const t = now();
    const b = buckets.get(key) ?? { tokens: burst, updated: t };
    b.tokens = Math.min(burst, b.tokens + (t - b.updated) * refillPerMs);
    b.updated = t;
    // Bounded memory without resetting everyone: drop the least recently used keys (a Map keeps
    // insertion order, and every use re-inserts its key at the end).
    buckets.delete(key);
    if (buckets.size >= 10_000) {
      for (const k of buckets.keys()) {
        buckets.delete(k);
        if (buckets.size < 9_000) break;
      }
    }
    if (b.tokens < 1) {
      buckets.set(key, b);
      return false;
    }
    b.tokens -= 1;
    buckets.set(key, b);
    return true;
  };
}

const perMinute = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 60);
const limiter = createRateLimiter(perMinute);
// Writes (every POST, PATCH, PUT and DELETE route) get their own, smaller bucket, so browsing
// the map never eats into saving and posting, and scripted abuse of write routes is capped.
const writeLimiter = createRateLimiter(Number(process.env.RATE_LIMIT_WRITES_PER_MINUTE ?? Math.max(1, Math.floor(perMinute / 2))));

/**
 * The caller's address. The left of X-Forwarded-For is whatever the client sent, so it cannot be
 * trusted; each proxy in front of the app appends the address it saw. The entry TRUSTED_PROXY_HOPS
 * from the right (default 1: the one added by the host's own proxy) is the real client.
 */
export function clientIp(req: Request): string {
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS ?? 1));
  const chain = (req.headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return chain[chain.length - hops] ?? chain[0] ?? req.headers.get("x-real-ip") ?? "local";
}

/** Returns a 429 response when the caller is over the limit, otherwise null. */
export function rateLimit(req: Request) {
  if (limiter(clientIp(req))) return null;
  return fail(429, { code: "rate_limited", message: "Too many requests. Wait a moment and try again." });
}

/** Rate limit for write routes (docs/05 Phase 6 security review). */
export function rateLimitWrite(req: Request) {
  if (writeLimiter(clientIp(req))) return null;
  return fail(429, { code: "rate_limited", message: "Too many requests. Wait a moment and try again." });
}
