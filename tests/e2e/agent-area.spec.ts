import { fillAgentWizard, uniqueLicense } from "./support/agents";
import { signIn, signInAs } from "./support/auth";
import { db } from "./support/db";
import { expect, test } from "./support/fixtures";

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
