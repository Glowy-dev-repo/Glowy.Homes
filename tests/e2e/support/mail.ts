import { createHash } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Marks a link as taken by this test; false if another test already took it (atomic create). */
function claim(link: string): boolean {
  const dir = resolve(process.cwd(), ".dev-mail", "claimed");
  mkdirSync(dir, { recursive: true });
  try {
    closeSync(openSync(resolve(dir, createHash("sha1").update(link).digest("hex")), "wx"));
    return true;
  } catch {
    return false;
  }
}

type Sent = { subject: string; link?: string; sentAt?: string };

/** Every email to `to` (newest first). Mirrors devMailFolder in src/lib/email: one file per email. */
export function recentEmails(to: string): Sent[] {
  const folder = resolve(process.cwd(), ".dev-mail", "all", to.toLowerCase().replace(/[^a-z0-9@._]/g, "_"));
  if (!existsSync(folder)) return [];
  return readdirSync(folder)
    .sort()
    .reverse()
    .slice(0, 50)
    .flatMap((f) => {
      try {
        return [JSON.parse(readFileSync(resolve(folder, f), "utf8")) as Sent];
      } catch {
        return []; // caught mid write; the next poll reads it
      }
    });
}

/**
 * Waits for the app's log transport to record an email to `to` and returns its primary link. With
 * `match`, only links that match count. With `since`, only emails sent after that moment count and the
 * earliest one wins, so tests signing in as the same person at once each take their own link.
 */
export async function waitForEmailLink(to: string, timeoutMs = 15_000, match?: RegExp, since?: number): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const candidates = recentEmails(to).filter((m) => m.link && (!match || match.test(m.link)) && (since === undefined || Date.parse(m.sentAt ?? "") >= since));
    if (since === undefined) {
      if (candidates[0]?.link) return candidates[0].link;
    } else {
      // Oldest first, and each link goes to one test only: two tests signing in as the same person to the
      // same page at once would otherwise both follow the first link (a sign in link works once).
      for (const m of [...candidates].reverse()) if (m.link && claim(m.link)) return m.link;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`No email to ${to}${match ? ` matching ${match}` : ""} within ${timeoutMs}ms. Is EMAIL_TRANSPORT=log set for the app?`);
}

/** Sign in link for one page: the callback in the link must be `callbackUrl`. */
export const signInLinkFor = (callbackUrl: string) => new RegExp(`/api/auth/callback/.*callbackUrl=[^&]*${encodeURIComponent(callbackUrl).replace(/[.*()]/g, (c) => `[${c}]`)}(&|$)`);

/** Sign in links only: other emails to the same person (admins get many) never stand in for them. */
export const SIGN_IN_LINK = /\/api\/auth\/callback\//;

export const uniqueEmail = (tag: string) =>
  `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

