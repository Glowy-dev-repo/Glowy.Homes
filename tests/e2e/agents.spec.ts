import { db } from "./support/db";
import { expect, test } from "./support/fixtures";

test.describe("local agents by ZIP code", () => {
  test("a ZIP code shows its partner agents, best match first, and a question can go to one", async ({ page }) => {
    const [row] = await db()<{ zip: string }[]>`
      select z.zip from pro_zip_codes z join pros p on p.id = z.pro_id
      where p.status = 'active' and p.pro_type = 'agent' and p.is_accepting_leads group by z.zip order by count(*) desc, z.zip limit 1`;
    await page.goto("/agents");
    await page.getByLabel("ZIP code").fill(row.zip);
    await page.getByRole("button", { name: "Find my agent" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/agents" && url.searchParams.get("zip") === row.zip);
    const results = page.getByTestId("zip-agents");
    await expect(results.getByRole("heading", { name: `Partner agents for ZIP ${row.zip}` })).toBeVisible();
    await expect(results.getByTestId("zip-agent").first().getByTestId("best-match")).toBeVisible();
    await expect(results.getByTestId("best-match")).toHaveCount(1);

    await results.getByTestId("zip-agent").first().getByRole("button", { name: /^Ask .+ a question$/ }).click();
    await expect(page.getByRole("dialog").getByTestId("lead-recipient")).toContainText(`partner agent for ZIP ${row.zip}`);
  });

  test("an invalid ZIP code explains what to enter; an uncovered one says so", async ({ page }) => {
    await page.goto("/agents?zip=12");
    await expect(page.locator("#zip-error")).toHaveText("Enter a 5 digit ZIP code.");
    await page.goto("/agents?zip=00001");
    await expect(page.getByRole("heading", { name: "No partner agent covers ZIP 00001 yet" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Los Angeles" }).first()).toHaveAttribute("href", "/agents/los-angeles");
  });
});
