import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { signIn } from "./support/auth";
import { db, sampleListingPath } from "./support/db";
import { expect, test } from "./support/fixtures";

/** Every estimate card that shows a number must also show a range, a confidence label and the disclaimer. */
async function expectCompleteEstimates(page: Page) {
  const cards = page.getByTestId("estimate-card");
  const n = await cards.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const card = cards.nth(i);
    await expect(card.getByTestId("estimate-disclaimer")).toContainText("This is an automated estimate, not an appraisal.");
    if (await card.getByTestId("estimate-value").count()) {
      await expect(card.getByTestId("estimate-range")).toHaveText(/\$[\d,]+ to \$[\d,]+/);
      await expect(card.getByTestId("estimate-confidence")).toContainText(/Confidence: (Low|Medium|High)/);
    } else {
      await expect(card.getByTestId("estimate-unavailable")).toBeVisible();
    }
  }
}

function mailFor(email: string): { link?: string } | null {
  const f = resolve(process.cwd(), ".dev-mail", `${email.toLowerCase().replace(/[^a-z0-9@._]/g, "_")}.json`);
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
}

test.describe("estimates", () => {
  test("no estimate renders without range, confidence and disclaimer", async ({ page }) => {
    for (const where of ["l.property_type = 'condo'", "l.property_type = 'detached'", "l.property_type = 'land'"]) {
      const { path } = await sampleListingPath(`l.listing_type = 'sale' and l.status = 'active' and ${where}`);
      await page.goto(path);
      await expectCompleteEstimates(page);
    }
    const [p] = await db()`select p.id from properties p join listings l on l.property_id = p.id where l.status = 'sold' limit 1`;
    await page.goto(`/home-value/${p.id}/x`);
    await expect(page).toHaveURL(new RegExp(`/home-value/${p.id}/`));
    await expectCompleteEstimates(page);
    await expect(page.getByRole("heading", { name: "Value history" })).toBeVisible();
    await expect(page.getByTestId("comps-table").locator("tbody tr")).not.toHaveCount(0);
  });

  test("an unknown address inside a covered city becomes a new property with an estimate", async ({ page }) => {
    const [street] = await db()`
      select regexp_replace(address_line1, '^[0-9]+ ', '') as street, city, max(split_part(address_normalized, ' ', 1)::int) as maxnum
      from properties where city = 'Hamilton' and property_type = 'detached' and address_line2 is null
      group by 1, 2 having count(*) > 5 order by count(*) desc limit 1`;
    const address = `${street.maxnum + 2} ${street.street}, ${street.city}`;
    await page.goto("/home-value");
    await page.getByLabel("Your home address").fill(address);
    await page.getByRole("button", { name: "Get estimate" }).click();
    await expect(page).toHaveURL(/\/home-value\/[0-9a-f-]{36}\//, { timeout: 15_000 });
    await expect(page.getByTestId("property-address")).toContainText(String(street.maxnum + 2));
    await expectCompleteEstimates(page);
    const [row] = await db()`select source, city_region_id from properties where id = ${page.url().split("/")[4]}`;
    expect(row.source).toBe("lookup");
    expect(row.city_region_id).not.toBeNull();
  });

  test("addresses outside coverage get a clear message", async ({ page }) => {
    await page.goto("/home-value");
    await page.getByLabel("Your home address").fill("12 Nowhere Road, Timbuktu");
    await page.getByRole("button", { name: "Get estimate" }).click();
    // Scoped to the form: Next's route announcer is also role="alert".
    await expect(page.locator("form").getByRole("alert")).toContainText(/could not find|outside/);
  });

  test("methodology publishes accuracy by city", async ({ page }) => {
    await page.goto("/methodology");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("How our estimates work");
    await expect(page.getByTestId("accuracy-table").locator("tbody tr")).not.toHaveCount(0);
  });
});

test.describe("owner loop", () => {
  test("claim a home, edit its size, and the estimate updates within 10 seconds", async ({ page, isMobile }) => {
    test.skip(isMobile, "one owner flow per run keeps claims unique");
    // An unclaimed active listing home with a confident estimate.
    const [p] = await db()`
      select p.id from properties p join listings l on l.property_id = p.id
      join lateral (select amount from valuations v where v.property_id = p.id and v.kind = 'value' order by computed_at desc limit 1) v on v.amount > 0
      where p.owner_user_id is null and l.status = 'active' and l.listing_type = 'sale' and p.property_type = 'detached'
      order by p.id limit 1`;
    const email = await signIn(page, "owner", `/home-value/${p.id}/x`);
    await page.getByRole("button", { name: "This is my home" }).click();

    const panel = page.getByTestId("claim-panel");
    // Wait for the server's answer: a code step (production mode) or an instant claim (dev mode).
    await expect(panel.getByLabel("Verification code").or(panel.getByRole("status"))).toBeVisible();
    if (await panel.getByLabel("Verification code").isVisible()) {
      // Production mode: the code arrives by mail (the log transport in tests).
      await expect.poll(() => mailFor(email)?.link, { timeout: 10_000 }).toMatch(/^\d{6}$/);
      await panel.getByLabel("Verification code").fill(mailFor(email)!.link!);
      await panel.getByRole("button", { name: "Verify" }).click();
    }
    await expect(panel.getByRole("status")).toContainText("You claimed this home");

    await page.goto("/account/homes");
    const home = page.getByTestId("owned-home");
    const before = await home.getByTestId("estimate-value").textContent();
    const area = home.getByLabel(/Interior area/);
    const current = Number(await area.inputValue());
    await area.fill(String(Math.round(current * 1.5)));
    const started = Date.now();
    await home.getByRole("button", { name: "Save and update estimate" }).click();
    await expect(home.getByRole("status")).toContainText("Your estimate is updated", { timeout: 10_000 });
    await expect(home.getByTestId("estimate-value")).not.toHaveText(before!, { timeout: 10_000 - (Date.now() - started) });
    expect(Date.now() - started).toBeLessThan(10_000);
    await expectCompleteEstimates(page);

    const [owned] = await db()`select owner_facts_override->>'sqft' as sqft from properties where id = ${p.id}`;
    expect(Number(owned.sqft)).toBeGreaterThan(0);

    // Thinking of selling creates a sell lead with consent recorded.
    await home.getByRole("button", { name: "Thinking of selling?" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Contact an agent" }).click();
    await expect(dialog.getByText("Please agree to be contacted")).toBeVisible();
    await expect(dialog.getByText("Enter your name.")).toBeVisible();
    await dialog.getByLabel("Name").fill("Pat Owner");
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Contact an agent" }).click();
    await expect(dialog.getByRole("status")).toContainText("match you with an agent");
    const [lead] = await db()`select lead_type, payload from leads where consumer_email = ${email} order by created_at desc limit 1`;
    expect(lead.lead_type).toBe("sell");
    expect(lead.payload.consent.version).toBeTruthy();
  });
});
