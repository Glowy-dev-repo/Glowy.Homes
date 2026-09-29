import { brand } from "@/config/brand";
import { nameForEmail } from "../safe-name";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Invitation to a shared saved homes list (docs/05 Phase 6 task 4). */
export function shareInviteEmail(opts: { inviterName: string; href: string }) {
  const inviter = nameForEmail(opts.inviterName);
  const subject = `${inviter} wants to share saved homes with you on ${brand.name}`;
  const body = `${inviter} invited you to a shared list of saved homes. You will see the homes they save, and they will see yours. The invitation works for 14 days.`;
  return {
    subject,
    text: `${subject}\n\n${body}\n\nAccept: ${opts.href}`,
    html: `<!doctype html><html><body style="margin:0;background:#fafafa;font-family:Inter,Arial,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#fff;border:1px solid #e4e4e7;border-radius:14px"><tr><td style="padding:32px">
<p style="margin:0 0 20px;font-weight:600">${esc(brand.name)}</p>
<h1 style="margin:0 0 12px;font-size:22px;font-weight:600">Shared saved homes</h1>
<p style="font-size:15px;line-height:1.6;color:#3f3f46">${esc(body)}</p>
<p style="margin:24px 0 0"><a href="${esc(opts.href)}" style="display:inline-block;background:${brand.color};color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">Accept the invitation</a></p>
</td></tr></table></td></tr></table></body></html>`,
    link: opts.href,
  };
}
