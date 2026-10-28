import { describe, expect, it } from "vitest";
import {
  adminLeadClosedEmail,
  adminNewAgentEmail,
  adminNoReplyEmail,
  proApplicationReceivedEmail,
  proApprovedEmail,
  proInviteEmail,
  proLeadReminderEmail,
  proNotApprovedEmail,
  proSuspendedEmail,
} from "@/lib/email/templates/pros";

const appUrl = "https://glowyhomes.com";
const evil = "<script>alert(1)</script>";

const all = {
  application: proApplicationReceivedEmail({ appUrl, name: evil }),
  adminNewAgent: adminNewAgentEmail({ appUrl, proId: "p1", name: evil, license: "01364089", zips: ["93021", "91320"] }),
  approved: proApprovedEmail({ appUrl, name: evil, slug: "dana-reyes-abc12" }),
  notApproved: proNotApprovedEmail({ appUrl, name: evil, reason: evil }),
  suspended: proSuspendedEmail({ appUrl, name: evil, reason: evil }),
  invite: proInviteEmail({ appUrl, name: evil, inviterName: "Konner King" }),
  reminder: proLeadReminderEmail({ appUrl, leadId: "l1", leadType: "tour", address: "12 Oak St, Moorpark" }),
  noReply: adminNoReplyEmail({ appUrl, leadId: "l1", agentName: evil, minutes: 60 }),
  closed: adminLeadClosedEmail({ appUrl, leadId: "l1", agentName: evil, address: "12 Oak St, Moorpark", closePrice: 750000, closeDate: "2026-10-20" }),
};

describe("partner agent emails", () => {
  it.each(Object.entries(all))("%s links into the site", (_name, email) => {
    expect(email.link.startsWith(appUrl)).toBe(true);
    expect(email.html).toContain(email.link);
  });

  it.each(Object.entries(all))("%s escapes names and reasons in the html", (_name, email) => {
    expect(email.html).not.toContain("<script>");
  });

  it.each(Object.entries(all))("%s has no dashes and makes no guarantees", (_name, email) => {
    for (const part of [email.subject, email.text, email.html.replace(/<[^>]+>/g, " ")]) {
      expect(part).not.toMatch(/[—–]| - /);
      expect(part.toLowerCase()).not.toContain("guarantee");
    }
  });

  it("points each email where the reader acts", () => {
    expect(all.adminNewAgent.link).toBe(`${appUrl}/admin/agents/p1`);
    expect(all.approved.link).toBe(`${appUrl}/pro/dashboard`);
    expect(all.invite.link).toBe(`${appUrl}/pro`);
    expect(all.reminder.link).toBe(`${appUrl}/pro/leads?lead=l1`);
    expect(all.noReply.link).toBe(`${appUrl}/admin/leads?lead=l1`);
    expect(all.closed.text).toContain("$750,000");
  });
});
