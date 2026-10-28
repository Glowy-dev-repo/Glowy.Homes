import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Resend } from "resend";
import { emailTransport, env } from "@/lib/env";

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Primary link in the email; recorded by the log transport so tests can follow it. */
  link?: string;
  /** Extra headers, for example List-Unsubscribe on alert emails. */
  headers?: Record<string, string>;
};

export const DEV_MAIL_DIR = resolve(process.cwd(), ".dev-mail");

/** File name for the latest email to a recipient in the log transport. */
export function devMailFile(to: string): string {
  return resolve(DEV_MAIL_DIR, `${to.toLowerCase().replace(/[^a-z0-9@._]/g, "_")}.json`);
}

/** Folder holding every email to a recipient in the log transport, one file each (name starts with the time). */
export function devMailFolder(to: string): string {
  return resolve(DEV_MAIL_DIR, "all", to.toLowerCase().replace(/[^a-z0-9@._]/g, "_"));
}

export async function sendEmail(email: OutgoingEmail): Promise<void> {
  if (emailTransport() === "log") {
    await mkdir(DEV_MAIL_DIR, { recursive: true });
    const sent = { ...email, sentAt: new Date().toISOString() };
    // The latest email per person, plus every email as its own file in a folder per person, so a test
    // waiting for one email is never thrown off by another arriving for the same person at once.
    await writeFile(devMailFile(email.to), JSON.stringify(sent, null, 2));
    const folder = devMailFolder(email.to);
    await mkdir(folder, { recursive: true });
    await writeFile(resolve(folder, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`), JSON.stringify(sent, null, 2));
    // Links (sign in links included) only reach the console outside production.
    const showLink = email.link && process.env.NODE_ENV !== "production";
    console.info(`[email:log] to=${email.to} subject="${email.subject}"${showLink ? ` link=${email.link}` : ""}`);
    return;
  }

  const e = env();
  const resend = new Resend(e.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: e.EMAIL_FROM,
    to: email.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
    headers: email.headers,
  });
  if (error) throw new Error(`Resend failed: ${error.message}`);
}
