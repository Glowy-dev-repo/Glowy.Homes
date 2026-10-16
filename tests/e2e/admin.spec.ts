import { db } from "./support/db";
import { expect, test } from "./support/fixtures";
import { waitForEmailLink } from "./support/mail";

test("admin sees every agent, ZIP code coverage and can filter all leads by ZIP code", async ({ page, isMobile }) => {
  test.skip(isMobile, "admin desktop flow");
  await page.goto(`/signin?callbackUrl=${encodeURIComponent("/admin/agents")}`);
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByRole("button", { name: "Email me a sign in link" }).click();
  await expect(page).toHaveURL(/check-email/);
  await page.goto(await waitForEmailLink("admin@example.com"));

  // Agents: the list, then a status filter carried in the URL.
  await expect(page.getByRole("heading", { name: "Partner agents" })).toBeVisible();
  await expect(page.getByTestId("admin-agent").first()).toBeVisible();
  await page.getByLabel("Status").selectOption("active");
  await page.getByRole("button", { name: "Filter" }).click();
  await expect(page).toHaveURL(/status=active/);
  await expect(page.getByTestId("admin-agent").first()).toContainText("Active");

  // ZIP codes: every covered ZIP is listed with its agents.
  await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "ZIP codes" }).click();
  await expect(page.getByRole("heading", { name: "ZIP code coverage" })).toBeVisible();
  const [covered] = await db()<{ zip: string }[]>`
    select z.zip from pro_zip_codes z join pros p on p.id = z.pro_id where p.status = 'active' and p.pro_type = 'agent' order by z.zip limit 1`;
  await expect(page.getByTestId("zip-row").filter({ hasText: covered.zip }).first()).toBeVisible();

  // All leads, filtered to a ZIP code that has leads.
  const [withLeads] = await db()<{ zip: string }[]>`
    select left(p.postal_code, 5) as zip from leads ld join listings l on l.id = ld.listing_id join properties p on p.id = l.property_id
    group by 1 order by count(*) desc limit 1`;
  test.skip(!withLeads, "needs at least one lead");
  await page.goto(`/admin/leads?zip=${withLeads.zip}`);
  const rows = page.getByTestId("all-lead");
  await expect(rows.first()).toBeVisible();
  for (const zip of await rows.locator("td:nth-child(5)").allTextContents()) expect(zip).toBe(withLeads.zip);
  await expect(page.getByLabel("ZIP code")).toHaveValue(withLeads.zip);
});
