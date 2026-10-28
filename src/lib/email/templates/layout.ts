import { brand } from "@/config/brand";

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The one card layout every transactional email uses. */
export function layout(title: string, body: string, cta?: { href: string; label: string }) {
  return `<!doctype html><html><body style="margin:0;background:#fafafa;font-family:Inter,Arial,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#fff;border:1px solid #e4e4e7;border-radius:14px"><tr><td style="padding:32px">
<p style="margin:0 0 20px;font-weight:600">${esc(brand.name)}</p>
<h1 style="margin:0 0 12px;font-size:22px;font-weight:600">${esc(title)}</h1>
${body}
${cta ? `<p style="margin:24px 0 0"><a href="${esc(cta.href)}" style="display:inline-block;background:${brand.color};color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">${esc(cta.label)}</a></p>` : ""}
</td></tr></table></td></tr></table></body></html>`;
}

/** Paragraphs of plain text as email html, each escaped. */
export const paragraphs = (lines: string[]) => lines.map((l) => `<p style="font-size:15px;line-height:1.6;color:#3f3f46">${esc(l)}</p>`).join("");
