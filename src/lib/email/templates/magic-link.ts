import { brand } from "@/config/brand";

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function magicLinkEmail(url: string) {
  const subject = `Sign in to ${brand.name}`;
  const text = `Sign in to ${brand.name}\n\nOpen this link to sign in:\n${url}\n\nThe link expires in 24 hours. If you did not ask for it, you can ignore this email.`;
  const html = `<!doctype html>
<html><body style="margin:0;background:#fafafa;font-family:Inter,Arial,sans-serif;color:#18181b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="100%" style="max-width:480px;background:#fff;border:1px solid #e4e4e7;border-radius:14px">
      <tr><td style="padding:32px">
        <p style="margin:0 0 24px;font-weight:600;font-size:17px">${escape(brand.name)}</p>
        <h1 style="margin:0 0 12px;font-size:22px;font-weight:600">Sign in to your account</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#52525b">Tap the button below to sign in. The link expires in 24 hours.</p>
        <a href="${escape(url)}" style="display:inline-block;background:${brand.color};color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:10px">Sign in</a>
        <p style="margin:24px 0 0;font-size:13px;line-height:1.45;color:#71717a">If you did not ask for this email, you can ignore it.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  return { subject, text, html };
}
