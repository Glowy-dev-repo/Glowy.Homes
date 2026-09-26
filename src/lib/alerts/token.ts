import { createHmac, timingSafeEqual } from "node:crypto";

// One click unsubscribe from a single saved search (docs/03 section 6), without signing in.

const secret = () => process.env.AUTH_SECRET ?? "dev-secret";

export function unsubscribeToken(savedSearchId: string): string {
  return createHmac("sha256", secret()).update(`unsubscribe:${savedSearchId}`).digest("base64url").slice(0, 32);
}

export function verifyUnsubscribeToken(savedSearchId: string, token: string | null): boolean {
  if (!token) return false;
  const expected = Buffer.from(unsubscribeToken(savedSearchId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
