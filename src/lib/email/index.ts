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

export async function sendEmail(email: OutgoingEmail): Promise<void> {
  if (emailTransport() === "log") {
    await mkdir(DEV_MAIL_DIR, { recursive: true });
    await writeFile(devMailFile(email.to), JSON.stringify({ ...email, sentAt: new Date().toISOString() }, null, 2));
    console.info(`[email:log] to=${email.to} subject="${email.subject}"${email.link ? ` link=${email.link}` : ""}`);
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
