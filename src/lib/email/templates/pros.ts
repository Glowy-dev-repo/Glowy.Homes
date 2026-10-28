import { brand } from "@/config/brand";
import { formatDate, formatPrice } from "@/lib/format";
import { nameForEmail } from "../safe-name";
import { layout, paragraphs } from "./layout";

// Emails for partner agents and the admins who manage them (docs/superpowers/plans/2026-10-27-agent-area.md).

type Email = { subject: string; text: string; html: string; link: string };

const LEAD_LABEL: Record<string, string> = { tour: "tour request", contact: "question", sell: "seller inquiry", rental_inquiry: "rental inquiry", rental_application: "rental application" };

function build(subject: string, greeting: string | null, lines: string[], cta: { href: string; label: string }): Email {
  const body = greeting ? [greeting, ...lines] : lines;
  return {
    subject,
    text: `${body.join("\n\n")}\n\n${cta.label}: ${cta.href}`,
    html: layout(subject, paragraphs(body), cta),
    link: cta.href,
  };
}

const hi = (name: string | null) => `Hi ${nameForEmail(name, "there")},`;

export function proApplicationReceivedEmail(opts: { appUrl: string; name: string }): Email {
  return build(
    `We received your ${brand.name} partner application`,
    hi(opts.name),
    [
      `Thank you for applying to be a ${brand.name} partner agent.`,
      "We check every California DRE license before an agent receives inquiries. This typically takes one business day, and we will email you when it is done.",
    ],
    { href: `${opts.appUrl}/pro/dashboard`, label: "See your application" },
  );
}

export function adminNewAgentEmail(opts: { appUrl: string; proId: string; name: string; license: string | null; zips: string[] }): Email {
  const zips = opts.zips.length ? opts.zips.slice(0, 12).join(", ") + (opts.zips.length > 12 ? ` and ${opts.zips.length - 12} more` : "") : "none chosen";
  return build(
    "New partner agent waiting for approval",
    null,
    [`${nameForEmail(opts.name, "A new agent")} applied to be a partner agent.`, `DRE license: ${opts.license ?? "not given"}`, `ZIP codes: ${zips}`, "Check the license on the DRE site before you approve."],
    { href: `${opts.appUrl}/admin/agents/${opts.proId}`, label: "Review the application" },
  );
}

export function proApprovedEmail(opts: { appUrl: string; name: string; slug: string }): Email {
  return build(
    `You are now a ${brand.name} partner agent`,
    hi(opts.name),
    [
      "Your license check is complete and your public profile is live.",
      `${brand.name} reviews every inquiry and assigns it to a partner agent who serves the home's ZIP code. When one is assigned to you, we email you right away.`,
      `Your public profile: ${opts.appUrl}/agent/${opts.slug}`,
    ],
    { href: `${opts.appUrl}/pro/dashboard`, label: "Open your workspace" },
  );
}

export function proNotApprovedEmail(opts: { appUrl: string; name: string; reason: string | null }): Email {
  return build(
    `About your ${brand.name} partner application`,
    hi(opts.name),
    [
      "We were not able to approve your partner application.",
      ...(opts.reason ? [`Reason: ${opts.reason}`] : []),
      `If something needs correcting, reply to ${brand.supportEmail} and we will take another look.`,
    ],
    { href: `${opts.appUrl}/pro/dashboard`, label: "See your application" },
  );
}

export function proSuspendedEmail(opts: { appUrl: string; name: string; reason: string | null }): Email {
  return build(
    `Your ${brand.name} partner account is paused`,
    hi(opts.name),
    [
      "Your partner account is paused, so new inquiries will not be assigned to you and your public profile is hidden.",
      ...(opts.reason ? [`Reason: ${opts.reason}`] : []),
      `Questions? Contact ${brand.supportEmail}.`,
    ],
    { href: `${opts.appUrl}/pro/dashboard`, label: "Open your workspace" },
  );
}

export function proInviteEmail(opts: { appUrl: string; name: string | null; inviterName: string }): Email {
  return build(
    `${nameForEmail(opts.inviterName, brand.name)} invited you to be a ${brand.name} partner agent`,
    hi(opts.name),
    [
      `${brand.name} connects people searching for homes in ${brand.market.region} with local partner agents. Every inquiry is reviewed by our team and assigned to an agent who serves the home's ZIP code.`,
      "Applying takes a few minutes. You will need your California DRE license number and the ZIP codes you serve.",
    ],
    { href: `${opts.appUrl}/pro`, label: "See how it works" },
  );
}

export function proLeadReminderEmail(opts: { appUrl: string; leadId: string; leadType: string; address: string | null }): Email {
  const kind = LEAD_LABEL[opts.leadType] ?? "inquiry";
  return build(
    `Reminder: a ${kind} is waiting for your reply`,
    null,
    [`A ${kind}${opts.address ? ` about ${opts.address}` : ""} was assigned to you and has no reply yet.`, "People typically choose the first agent who gets back to them. Reply or update the status in your inbox."],
    { href: `${opts.appUrl}/pro/leads?lead=${opts.leadId}`, label: "Open the lead" },
  );
}

export function adminNoReplyEmail(opts: { appUrl: string; leadId: string; agentName: string; minutes: number }): Email {
  return build(
    "An assigned lead has no reply",
    null,
    [`${nameForEmail(opts.agentName, "The agent")} has not replied to a lead assigned ${opts.minutes} minutes ago, including after a reminder.`, "You may want to assign it to another partner agent."],
    { href: `${opts.appUrl}/admin/leads?lead=${opts.leadId}`, label: "Open the lead" },
  );
}

export function adminLeadClosedEmail(opts: { appUrl: string; leadId: string; agentName: string; address: string | null; closePrice: number; closeDate: string }): Email {
  return build(
    "A partner agent closed a lead",
    null,
    [
      `${nameForEmail(opts.agentName, "A partner agent")} marked a lead as closed${opts.address ? ` for ${opts.address}` : ""}.`,
      `Sale price: ${formatPrice(opts.closePrice)}`,
      `Closing date: ${formatDate(opts.closeDate)}`,
    ],
    { href: `${opts.appUrl}/admin/leads?lead=${opts.leadId}`, label: "Open the lead" },
  );
}

