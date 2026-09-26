import { brand } from "@/config/brand";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const TYPE_LABEL: Record<string, string> = {
  tour: "tour request",
  contact: "question",
  sell: "seller inquiry",
  preapproval: "preapproval request",
  rental_inquiry: "rental inquiry",
  rental_application: "rental application",
};

function layout(title: string, body: string, cta?: { href: string; label: string }) {
  return `<!doctype html><html><body style="margin:0;background:#fafafa;font-family:Inter,Arial,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#fff;border:1px solid #e4e4e7;border-radius:14px"><tr><td style="padding:32px">
<p style="margin:0 0 20px;font-weight:600">${esc(brand.name)}</p>
<h1 style="margin:0 0 12px;font-size:22px;font-weight:600">${esc(title)}</h1>
${body}
${cta ? `<p style="margin:24px 0 0"><a href="${esc(cta.href)}" style="display:inline-block;background:${brand.color};color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">${esc(cta.label)}</a></p>` : ""}
</td></tr></table></td></tr></table></body></html>`;
}

export function proNewLeadEmail(opts: { appUrl: string; leadId: string; leadType: string; consumerName: string; consumerEmail: string; consumerPhone: string | null; address: string | null; message: string | null }) {
  const kind = TYPE_LABEL[opts.leadType] ?? "lead";
  const href = `${opts.appUrl}/pro/leads?lead=${opts.leadId}`;
  const lines = [
    `Name: ${opts.consumerName}`,
    `Email: ${opts.consumerEmail}`,
    opts.consumerPhone ? `Phone: ${opts.consumerPhone}` : null,
    opts.address ? `Home: ${opts.address}` : null,
    opts.message ? `Message: ${opts.message}` : null,
  ].filter(Boolean) as string[];
  const subject = `New ${kind}${opts.address ? ` for ${opts.address}` : ""}`;
  return {
    subject,
    text: `${subject}\n\n${lines.join("\n")}\n\nReply within 30 minutes to keep this lead. Open your inbox: ${href}`,
    html: layout(subject, `<p style="font-size:15px;line-height:1.6;color:#3f3f46">${lines.map(esc).join("<br>")}</p><p style="font-size:13px;color:#71717a">Reply within 30 minutes to keep this lead.</p>`, { href, label: "Open lead" }),
    link: href,
  };
}

export function consumerConfirmationEmail(opts: { appUrl: string; consumerName: string; leadType: string; proName: string | null; brokerage: string | null; address: string | null }) {
  const kind = TYPE_LABEL[opts.leadType] ?? "request";
  const subject = opts.proName ? `${opts.proName} will be in touch` : `We received your ${kind}`;
  const who = opts.proName
    ? `${opts.proName}${opts.brokerage ? ` of ${opts.brokerage}` : ""} received your ${kind}${opts.address ? ` about ${opts.address}` : ""} and will typically reply within a few hours.`
    : `We received your ${kind}${opts.address ? ` about ${opts.address}` : ""} and are matching you with a local professional.`;
  const href = `${opts.appUrl}/account/inquiries`;
  return {
    subject,
    text: `Hi ${opts.consumerName},\n\n${who}\n\nSee your inquiries: ${href}`,
    html: layout(subject, `<p style="font-size:15px;line-height:1.6;color:#3f3f46">Hi ${esc(opts.consumerName)},</p><p style="font-size:15px;line-height:1.6;color:#3f3f46">${esc(who)}</p>`, { href, label: "See your inquiries" }),
    link: href,
  };
}

export function adminUnassignedEmail(opts: { appUrl: string; leadId: string; leadType: string; reason: string; region: string | null }) {
  const subject = `Unassigned ${TYPE_LABEL[opts.leadType] ?? "lead"}${opts.region ? ` in ${opts.region}` : ""}`;
  const href = `${opts.appUrl}/admin/leads?lead=${opts.leadId}`;
  return {
    subject,
    text: `${subject}\nReason: ${opts.reason}\nReassign it here: ${href}`,
    html: layout(subject, `<p style="font-size:15px;color:#3f3f46">Reason: ${esc(opts.reason)}</p>`, { href, label: "Reassign lead" }),
    link: href,
  };
}
