import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Mirrors devMailFile in src/lib/email: the log transport writes the latest email per recipient.
function mailFile(to: string) {
  return resolve(process.cwd(), ".dev-mail", `${to.toLowerCase().replace(/[^a-z0-9@._]/g, "_")}.json`);
}

/** Waits for the app's log transport to record an email to `to` and returns its primary link. */
export async function waitForEmailLink(to: string, timeoutMs = 15_000): Promise<string> {
  const file = mailFile(to);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(file)) {
      const { link } = JSON.parse(readFileSync(file, "utf8")) as { link?: string };
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`No email to ${to} within ${timeoutMs}ms. Is EMAIL_TRANSPORT=log set for the app?`);
}

export const uniqueEmail = (tag: string) =>
  `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
