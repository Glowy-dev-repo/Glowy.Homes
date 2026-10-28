import sharp from "sharp";
import { fillAgentWizard, uniqueLicense } from "./support/agents";
import { signIn, signInAs } from "./support/auth";
import { db } from "./support/db";
import { expect, test } from "./support/fixtures";
import { waitForEmailLink } from "./support/mail";

// The partner agent area: joining, the workspace, and what admin controls (docs/superpowers/plans/2026-10-27-agent-area.md).

test.describe("joining as a partner agent", () => {
  test("a DRE license already on a partner account is refused, however it is typed", async ({ page, browser, isMobile }) => {
    test.skip(isMobile, "desktop wizard flow");
    test.setTimeout(120_000);
    const license = uniqueLicense();
    await signIn(page, "license-first", "/pro/join");
    await fillAgentWizard(page, { name: `First Holder ${license}`, license });
    await expect(page).not.toHaveURL(/\/pro\/join/);

    const second = await browser.newPage();
    await signIn(second, "license-second", "/pro/join");
    await second.locator("html[data-hydrated]").waitFor({ state: "attached" });
    await fillAgentWizard(second, { name: `Second Holder ${license}`, license: `DRE# ${license.replace(/^0+/, "")}` });
    await expect(second.getByText("This DRE license already has a partner account. Contact support if this is you.")).toBeVisible();
    await second.close();

    const rows = await db()<{ n: number }[]>`select count(*)::int as n from pros where license_number = ${license}`;
    expect(rows[0].n).toBe(1);
  });
});

test.describe("admin manages a partner agent", () => {
  test("admin checks the license, approves, then suspends, and the agent loses access at once", async ({ page, browser, isMobile }) => {
    test.skip(isMobile, "admin desktop flow");
    test.setTimeout(120_000);
    const license = uniqueLicense();
    const name = `Status Agent ${license}`;
    await signIn(page, "status-agent", "/pro/join");
    await fillAgentWizard(page, { name, license });
    await expect(page).not.toHaveURL(/\/pro\/join/);
    const [pro] = await db()<{ id: string; slug: string }[]>`select id, slug from pros where display_name = ${name}`;
    expect((await page.request.get("/api/pro/leads")).status()).toBe(403);

    const admin = await browser.newPage();
    await signInAs(admin, "admin@example.com", `/admin/agents/${pro.id}`);
    await expect(admin.getByTestId("agent-status")).toHaveText("Waiting for approval");
    const dre = admin.getByTestId("agent-license").getByRole("link", { name: /check on the DRE site/ });
    await expect(dre).toHaveAttribute("href", `https://www2.dre.ca.gov/PublicASP/pplinfo.asp?License_id=${license}`);
    await expect(admin.getByTestId("agent-license")).toContainText("accepted");
    await admin.getByTestId("agent-status-form").getByRole("button", { name: "Approve", exact: true }).click();
    await expect(admin.getByTestId("agent-status")).toHaveText("Active");

    const [approved] = await db()<{ status: string; log: number; verified: boolean }[]>`
      select status, jsonb_array_length(status_log) as log, license_verified_at is not null as verified from pros where id = ${pro.id}`;
    expect(approved).toEqual({ status: "active", log: 1, verified: true });
    expect((await page.request.get("/api/pro/leads")).status()).toBe(200);

    // Suspending asks for a reason first.
    const form = admin.getByTestId("agent-status-form");
    await form.getByRole("button", { name: "Suspend" }).click();
    await form.getByRole("button", { name: "Confirm: Suspend" }).click();
    await expect(form.getByRole("status")).toContainText("Give a reason");
    await form.getByLabel(/Reason/).fill("Clients reported no replies");
    await form.getByRole("button", { name: "Confirm: Suspend" }).click();
    await expect(admin.getByTestId("agent-status")).toHaveText("Suspended");
    await expect(admin.getByTestId("agent-history")).toContainText("Clients reported no replies");
    await admin.close();

    expect((await page.request.get("/api/pro/leads")).status()).toBe(403);
    expect((await page.request.get(`/agent/${pro.slug}`)).status()).toBe(404);
  });
});

test.describe("admin invites agents", () => {
  test("an invite emails the agent a link to apply; an existing partner is not invited again", async ({ page, isMobile }) => {
    test.skip(isMobile, "admin desktop flow");
    const email = `invite-${Date.now()}@example.com`;
    await signInAs(page, "admin@example.com", "/admin/agents");
    const form = page.getByTestId("invite-agent");
    await form.getByLabel("Agent's email").fill(email.toUpperCase());
    await form.getByLabel("Name (optional)").fill("Ivy Invited");
    await form.getByRole("button", { name: "Send invite" }).click();
    await expect(form.getByRole("status")).toHaveText(`Invite sent to ${email}.`);
    expect(new URL(await waitForEmailLink(email)).pathname).toBe("/pro");
    await expect(page.getByTestId("invites")).toContainText(email);

    const [partner] = await db()<{ email: string }[]>`
      select u.email from pros p join users u on u.id = p.user_id where p.pro_type = 'agent' and p.status = 'active' limit 1`;
    await form.getByLabel("Agent's email").fill(partner.email);
    await form.getByRole("button", { name: "Send invite" }).click();
    await expect(form.getByRole("status")).toContainText("already has a partner account");
  });
});

test.describe("agent workspace", () => {
  test("an active agent gets their own workspace menu; a visitor who is not an agent is sent to the agent page", async ({ page, browser, isMobile }) => {
    // One agent per viewport: two runs signing in as the same person at once would race for one link.
    const [agent] = await db()<{ email: string }[]>`
      select u.email from pros p join users u on u.id = p.user_id where p.pro_type = 'agent' and p.status = 'active'
      order by p.created_at offset ${isMobile ? 3 : 4} limit 1`;
    await signInAs(page, agent.email, "/pro/leads");
    await expect(page.getByRole("heading", { level: 1, name: "Leads" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Agent" });
    for (const item of ["Overview", "Leads", "Profile", "Listings"]) await expect(nav.getByRole("link", { name: new RegExp(`^${item}`) })).toBeVisible();
    await expect(nav.getByRole("link", { name: /^Leads/ })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "View my public profile" })).toBeVisible();
    // The public site header is not part of the workspace.
    await expect(page.getByRole("contentinfo")).toHaveCount(0);

    const visitor = await browser.newPage();
    await signIn(visitor, "not-agent", "/");
    await visitor.goto("/pro/leads");
    await expect(visitor).toHaveURL(/\/pro$/);
    await visitor.close();
  });
});

test.describe("agent overview", () => {
  test("an active agent sees a lead waiting for their reply and their profile checklist", async ({ page, isMobile }) => {
    test.skip(isMobile, "one viewport is enough for the data shown");
    const [agent] = await db()<{ id: string; email: string }[]>`
      select p.id, u.email from pros p join users u on u.id = p.user_id where p.pro_type = 'agent' and p.status = 'active' order by p.created_at offset 1 limit 1`;
    const [lead] = await db()<{ id: string }[]>`
      insert into leads (lead_type, consumer_name, consumer_email, payload, status, assigned_pro_id, assigned_at, routing_log)
      values ('contact', 'Olive Overview', ${`overview-${Date.now()}@example.com`}, '{}'::jsonb, 'new', ${agent.id}, now(), '[]'::jsonb)
      returning id`;
    await signInAs(page, agent.email, "/pro/dashboard");
    const waiting = page.getByTestId("waiting-reply");
    await expect(waiting).toContainText("Olive Overview");
    await expect(waiting.getByRole("link", { name: "Reply" }).first()).toHaveAttribute("href", /\/pro\/leads\?lead=/);
    await expect(page.locator(`a[href="/pro/leads?lead=${lead.id}"]`)).toBeVisible();
    await expect(page.getByTestId("profile-checklist")).toBeVisible();
    await db()`delete from leads where id = ${lead.id}`;
  });
});

test.describe("agent profile photo", () => {
  test("an agent uploads a photo that shows on their public profile; a file that is not an image is refused", async ({ page, isMobile }) => {
    test.skip(isMobile, "one viewport is enough for uploads");
    const [agent] = await db()<{ id: string; email: string; slug: string; name: string }[]>`
      select p.id, u.email, p.slug, p.display_name as name from pros p join users u on u.id = p.user_id
      where p.pro_type = 'agent' and p.status = 'active' order by p.created_at offset 2 limit 1`;
    await signInAs(page, agent.email, "/pro/profile");
    const box = page.getByTestId("photo-upload");
    const png = await sharp({ create: { width: 600, height: 500, channels: 3, background: { r: 30, g: 80, b: 200 } } }).png().toBuffer();
    await box.getByLabel("Choose a profile photo").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: png });
    await expect(box.getByRole("status")).toHaveText("Photo saved.");
    const [saved] = await db()<{ photo: string | null }[]>`select photo_url as photo from pros where id = ${agent.id}`;
    expect(saved.photo).toMatch(new RegExp(`pros/${agent.id}/`));

    await page.goto(`/agent/${agent.slug}`);
    await expect(page.getByRole("img", { name: agent.name })).toBeVisible();

    await page.goto("/pro/profile");
    await box.getByLabel("Choose a profile photo").setInputFiles({ name: "fake.jpg", mimeType: "image/jpeg", buffer: Buffer.from("this is not a photo") });
    await expect(box.getByRole("status")).toHaveText("Choose a JPG, PNG or WebP photo.");
    const [kept] = await db()<{ photo: string | null }[]>`select photo_url as photo from pros where id = ${agent.id}`;
    expect(kept.photo).toBe(saved.photo);

    await box.getByRole("button", { name: "Remove" }).click();
    await expect(box.getByRole("status")).toHaveText("Photo removed.");
  });
});
