import { previewPassword } from "@/lib/preview";

// Cloudflare Turnstile (docs/02 section 8.4): lead forms are protected in production and the check
// is skipped when no secret is configured (development and tests).

export function turnstileEnabled(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

export async function verifyTurnstile(token: string | undefined, ip: string | null, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Without a key the bot check is off. That is fine in development, in tests (TURNSTILE_OPTIONAL=1) and
    // while the site is private behind the preview password; a public production site must have a key.
    if (process.env.NODE_ENV !== "production" || process.env.TURNSTILE_OPTIONAL === "1" || previewPassword()) return true;
    console.error("[turnstile] TURNSTILE_SECRET_KEY is not set on a public site; refusing unverified form submissions.");
    return false;
  }
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const res = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(5000) });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch {
    return false;
  }
}
