// Private preview (before the MLS feed is approved): when PREVIEW_PASSWORD is set, every page asks
// for that password first and the whole site is hidden from search engines. Delete the variable to launch.

export const PREVIEW_COOKIE = "gh_preview";
export const PREVIEW_MAX_AGE = 60 * 60 * 24 * 30;

/** The preview password, or null when the site is public. Placeholders count as unset. */
export function previewPassword(): string | null {
  const v = process.env.PREVIEW_PASSWORD?.trim();
  return v && !/replace_me|replace_with/i.test(v) ? v : null;
}

/** Cookie value proving the password was entered. Changing the password signs everyone out of the preview. */
export async function previewToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`glowhomes-preview:${password}:${process.env.AUTH_SECRET ?? ""}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant time string comparison. */
export function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// The password page itself, health checks for the host, background jobs (signed by Inngest) and robots.txt.
const EXEMPT = ["/preview", "/api/preview", "/api/health", "/api/inngest", "/robots.txt"];

export function isPreviewExempt(path: string): boolean {
  return EXEMPT.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Only same site paths may be returned to after the password, never another host. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
