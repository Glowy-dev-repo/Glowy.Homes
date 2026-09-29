/**
 * Key for signed links and tokens (lead status, unsubscribe, uploads). Production must have a real
 * AUTH_SECRET; a missing one fails loudly instead of signing with a guessable default.
 */
export function signingSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is not set; refusing to sign tokens with a default key.");
  return "dev-secret";
}
