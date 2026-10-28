import { fillAgentWizard, uniqueLicense } from "./support/agents";
import { signInAs } from "./support/auth";
import { db } from "./support/db";
import { expect, test } from "./support/fixtures";
import { recentEmails, waitForEmailLink } from "./support/mail";

// The whole partner agent journey, end to end (docs/superpowers/plans/2026-10-27-agent-area.md Task 12):
// invited, applies, locked out until approved, approved, works an assigned lead to closing, cannot see
// another agent's lead, then suspended and locked out again.
test("a partner agent from invite to closing, and suspension", async ({ page, browser, isMobile }) => {
  test.skip(isMobile, "multi party desktop flow");
  test.setTimeout(240_000);
  const stamp = Date.now();
  const email = `journey-${stamp}@example.com`;
  const license = uniqueLicense();
  const name = `Journey Agent ${stamp}`;

  // 1. Admin invites the agent.
  const admin = await browser.newPage();
  await signInAs(admin, "admin@example.com", "/admin/agents");
  await admin.getByTestId("invite-agent").getByLabel("Agent's email").fill(email);
  await admin.getByTestId("invite-agent").getByRole("button", { name: "Send invite" }).click();
  await expect(admin.getByTestId("invite-agent").getByRole("status")).toContainText("Invite sent");
  expect(new URL(await waitForEmailLink(email)).pathname).toBe("/pro");

  // 2. The agent reads how it works, signs in and applies.
  await page.goto("/pro");
  await expect(page.getByTestId("pro-steps")).toContainText("License check");
  await signInAs(page, email, "/pro/join");
  await fillAgentWizard(page, { name, license });
  await expect(page).toHaveURL(/\/pro\/dashboard/);
  await expect(page.getByTestId("application-steps")).toContainText("License check");
  expect(recentEmails(email).some((m) => m.subject.includes("partner application"))).toBe(true);
  // Locked out of lead data until approved.
  expect((await page.request.get("/api/pro/leads")).status()).toBe(403);
  const [pro] = await db()<{ id: string; slug: string }[]>`select id, slug from pros where display_name = ${name}`;
  const [invite] = await db()<{ joined: string | null }[]>`select accepted_pro_id as joined from pro_invites where lower(email) = ${email}`;
  expect(invite.joined).toBe(pro.id);

  // 3. Admin checks the license and approves.
  await admin.goto(`/admin/agents/${pro.id}`);
  await expect(admin.getByTestId("agent-license")).toContainText(license);
  await admin.getByTestId("agent-status-form").getByRole("button", { name: "Approve", exact: true }).click();
  await expect(admin.getByTestId("agent-status")).toHaveText("Active");
  expect(recentEmails(email).some((m) => m.subject.startsWith("You are now"))).toBe(true);
  await page.goto("/pro/dashboard");
  await expect(page.getByTestId("waiting-reply")).toBeVisible();

  // 4. A lead waits for Glowy Homes; admin assigns it to this agent.
  const [lead] = await db()<{ id: string }[]>`
    insert into leads (lead_type, consumer_name, consumer_email, payload, status, routing_log)
    values ('contact', 'Jules Journey', ${`journey-buyer-${stamp}@example.com`}, '{}'::jsonb, 'new',
      ${db().json([{ at: new Date().toISOString(), action: "awaiting_admin", reason: "waiting for Glowy Homes to choose" }])})
    returning id`;
  await admin.goto(`/admin/leads?lead=${lead.id}`);
  const card = admin.locator(`[data-lead-id="${lead.id}"]`).first();
  await card.getByTestId("reassign-form").getByRole("combobox").selectOption(pro.id);
  await card.getByTestId("reassign-form").getByRole("button", { name: "Assign" }).click();
  await expect.poll(async () => (await db()<{ pro: string | null }[]>`select assigned_pro_id as pro from leads where id = ${lead.id}`)[0].pro).toBe(pro.id);

  // 5. The agent sees it, replies, and closes it with the sale details.
  await page.goto("/pro/dashboard");
  await expect(page.getByTestId("waiting-reply")).toContainText("Jules Journey");
  await page.goto("/pro/leads");
  const row = page.locator(`[data-lead-id="${lead.id}"]`);
  await row.getByTestId("lead-status").selectOption("contacted");
  await expect.poll(async () => (await db()<{ status: string }[]>`select status from leads where id = ${lead.id}`)[0].status).toBe("contacted");
  await row.getByTestId("lead-status").selectOption("closed");
  const close = page.getByTestId("close-lead-form");
  await close.getByLabel("Sale price ($)").fill("980000");
  await close.getByLabel("Closing date").fill(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date()));
  await close.getByRole("button", { name: "Mark as closed" }).click();
  await expect.poll(async () => (await db()<{ status: string }[]>`select status from leads where id = ${lead.id}`)[0].status).toBe("closed");
  await admin.goto(`/admin/leads?lead=${lead.id}`);
  await expect(admin.locator(`[data-lead-id="${lead.id}"]`).first().getByTestId("lead-closing")).toContainText("$980,000");

  // 6. Another active agent cannot open this agent's lead.
  const [other] = await db()<{ email: string }[]>`
    select u.email from pros p join users u on u.id = p.user_id where p.pro_type = 'agent' and p.status = 'active' and p.id <> ${pro.id}
    order by p.created_at offset 7 limit 1`;
  const otherPage = await browser.newPage();
  await signInAs(otherPage, other.email, "/pro/leads");
  const peek = await otherPage.request.get(`/api/pro/leads/${lead.id}`);
  expect(peek.status()).toBe(404);
  expect(await peek.text()).not.toContain("Jules");
  await otherPage.close();

  // 7. Admin suspends the agent: locked out at once, profile hidden, open leads listed for reassignment.
  const [open] = await db()<{ id: string }[]>`
    insert into leads (lead_type, consumer_name, consumer_email, payload, status, assigned_pro_id, assigned_at, routing_log)
    values ('tour', 'Owen Open', ${`journey-open-${stamp}@example.com`}, '{}'::jsonb, 'new', ${pro.id}, now(), '[]'::jsonb) returning id`;
  await admin.goto(`/admin/agents/${pro.id}`);
  const form = admin.getByTestId("agent-status-form");
  await form.getByRole("button", { name: "Suspend" }).click();
  await form.getByLabel(/Reason/).fill("Test suspension");
  await form.getByRole("button", { name: "Confirm: Suspend" }).click();
  await expect(admin.getByTestId("agent-status")).toHaveText("Suspended");
  await expect(admin.getByTestId("agent-open-leads")).toContainText("Owen Open");
  expect((await page.request.get("/api/pro/leads")).status()).toBe(403);
  expect((await page.request.get(`/agent/${pro.slug}`)).status()).toBe(404);
  await admin.close();
  await db()`delete from leads where id in (${lead.id}, ${open.id})`;
});
