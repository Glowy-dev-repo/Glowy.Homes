import { createHmac, timingSafeEqual } from "node:crypto";
import { signingSecret } from "@/lib/secret";

// Signed, short lived permission to upload one image directly to the app (used when R2 is not
// configured). Binds the user, the storage key and an expiry.

const secret = signingSecret;

export function signUpload(userId: string, key: string, ttlSeconds = 600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = createHmac("sha256", secret()).update(`${userId}:${key}:${exp}`).digest("base64url");
  return `${exp}.${sig}`;
}

export function verifyUpload(userId: string, key: string, token: string | null): boolean {
  if (!token) return false;
  const [expRaw, sig] = token.split(".");
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now() / 1000 || !sig) return false;
  const expected = createHmac("sha256", secret()).update(`${userId}:${key}:${exp}`).digest("base64url");
  return expected.length === sig.length && timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}
