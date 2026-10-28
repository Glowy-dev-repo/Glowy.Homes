import { fillAgentWizard, uniqueLicense } from "./support/agents";
import { signIn } from "./support/auth";
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
