import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Mirrors devMailFile in src/lib/email: the log transport writes the latest email per recipient.
function mailFile(to: string) {
  return resolve(process.cwd(), ".dev-mail", `${to.toLowerCase().replace(/[^a-z0-9@._]/g, "_")}.json`);
}

/**
 * Waits for the app's log transport to record an email to `to` and returns its primary link. With
 * `match`, only links that match count (the transport keeps recent history per person). With `since`,
 * only emails sent after that moment count and the earliest one wins, so tests signing in as the same
 * person at once each take their own link.
 */
export async function waitForEmailLink(to: string, timeoutMs = 15_000, match?: RegExp, since?: number): Promise<string> {
  const file = mailFile(to);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(file)) {
      try {
        type Sent = { link?: string; sentAt?: string };
        const mail = JSON.parse(readFileSync(file, "utf8")) as Sent & { history?: Sent[] };
        const sent = mail.history?.length ? mail.history : [mail];
        const candidates = sent.filter((m) => m.link && (!match || match.test(m.link)) && (since === undefined || Date.parse(m.sentAt ?? "") >= since));
        const pick = since === undefined ? candidates[0] : candidates[candidates.length - 1];
        if (pick?.link) return pick.link;
      } catch {
        // Caught the file mid write; read it again.
      }
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
