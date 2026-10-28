import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Mirrors devMailFile in src/lib/email: the log transport writes the latest email per recipient.
function mailFile(to: string) {
  return resolve(process.cwd(), ".dev-mail", `${to.toLowerCase().replace(/[^a-z0-9@._]/g, "_")}.json`);
}

/**
 * Waits for the app's log transport to record an email to `to` and returns its primary link. With
 * `match`, returns the newest link that matches (the transport keeps recent history per person), so
 * another email to the same address cannot hide the one a test is waiting for.
 */
export async function waitForEmailLink(to: string, timeoutMs = 15_000, match?: RegExp): Promise<string> {
  const file = mailFile(to);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(file)) {
      try {
        const mail = JSON.parse(readFileSync(file, "utf8")) as { link?: string; history?: { link?: string }[] };
        const links = [mail.link, ...(mail.history ?? []).map((m) => m.link)].filter((l): l is string => !!l);
        const link = match ? links.find((l) => match.test(l)) : links[0];
        if (link) return link;
      } catch {
        // Caught the file mid write; read it again.
      }
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`No email to ${to}${match ? ` matching ${match}` : ""} within ${timeoutMs}ms. Is EMAIL_TRANSPORT=log set for the app?`);
}

/** Sign in links only: other emails to the same person (admins get many) never stand in for them. */
export const SIGN_IN_LINK = /\/api\/auth\/callback\//;

export const uniqueEmail = (tag: string) =>
  `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
