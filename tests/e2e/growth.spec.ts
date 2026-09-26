import { createHmac } from "node:crypto";
import type { Page } from "@playwright/test";
import { db, sampleListingPath } from "./support/db";
import { expect, test } from "./support/fixtures";
import { uniqueEmail, waitForEmailLink } from "./support/mail";

// docs/05 Phase 6: natural language search, shared lists, alert unsubscribe, analytics, summaries.

async function signInAs(page: Page, email: string, callbackUrl: string) {
  await page.goto(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign in link" }).click();
  await expect(page).toHaveURL(/check-email/);
  await page.goto(await waitForEmailLink(email));
}

test.describe("natural language search", () => {
  test("text becomes removable chips, then a search", async ({ page }) => {
    await page.goto("/search?city=los-angeles");
    await page.getByLabel("Describe the home you want").fill("3 bed condo under 900k in San Diego with parking");
    await page.getByRole("button", { name: "Read it" }).click();
    const chips = page.getByTestId("nl-chips");
    await expect(chips).toContainText("San Diego");
    await expect(chips).toContainText("3+ beds");
    await expect(chips).toContainText("Condo");
    await expect(chips).toContainText("Under $900,000");
    await chips.getByRole("button", { name: "Remove Parking" }).click();
    await expect(chips).not.toContainText("Parking");
    await chips.getByRole("button", { name: "Show homes" }).click();
    await expect(page).toHaveURL(/city=san-diego/);
    const url = new URL(page.url());
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ city: "san-diego", bedsMin: "3", propertyTypes: "condo", priceMax: "900000" });
    expect(url.searchParams.has("parking")).toBe(false);
  });
});

test.describe("shared saved homes", () => {
  test("a cobuyer accepts an invite and sees the owner's saved home", async ({ page, browser, isMobile }) => {
    test.skip(isMobile, "two account flow runs once");
    const owner = uniqueEmail("owner-share");
    const cobuyer = uniqueEmail("cobuyer");
    const listing = await sampleListingPath();

    await signInAs(page, owner, "/account/shared");
    const save = await page.request.post("/api/saved-homes", { data: { listingId: listing.id } });
    expect(save.ok()).toBe(true);
    await page.goto("/account/shared");
    await page.getByLabel("Invite by email").fill(cobuyer);
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Invitation sent." })).toBeVisible();
    await expect(page.getByTestId("share-people")).toContainText("Invitation sent");
    const invite = await waitForEmailLink(cobuyer);
    expect(invite).toContain("/account/shared/accept?token=");

    const other = await browser.newPage();
    await signInAs(other, cobuyer, new URL(invite).pathname + new URL(invite).search);
    await expect(other.getByRole("heading", { name: /shared list/ })).toBeVisible();
    await other.getByRole("button", { name: "Accept and see the list" }).click();
    await expect(other).toHaveURL(/\/account\/shared$/);
    const home = other.getByTestId("shared-home").filter({ has: other.locator(`a[href*="${listing.id}"]`) });
    await expect(home).toContainText("Saved by");
    await other.close();

    await page.reload();
    await expect(page.getByTestId("share-people")).toContainText("Sharing");
  });
});

test.describe("saved search alerts", () => {
  test("the unsubscribe link stops alerts for that search only", async ({ page }) => {
    const email = uniqueEmail("unsub");
    const [user] = await db()<{ id: string }[]>`insert into users (email) values (${email}) returning id`;
    const [a] = await db()<{ id: string }[]>`insert into saved_searches (user_id, name, filters, alert_frequency) values (${user.id}, 'Condos in Los Angeles', ${db().json({ type: "sale", city: "los-angeles" })}, 'daily') returning id`;
    const [b] = await db()<{ id: string }[]>`insert into saved_searches (user_id, name, filters, alert_frequency) values (${user.id}, 'Rentals', ${db().json({ type: "rent" })}, 'weekly') returning id`;
    const token = createHmac("sha256", process.env.AUTH_SECRET ?? "dev-secret").update(`unsubscribe:${a.id}`).digest("base64url").slice(0, 32);

    await page.goto(`/alerts/unsubscribe?id=${a.id}&token=${token}`);
    await expect(page.getByText("You will no longer get emails about new homes for Condos in Los Angeles")).toBeVisible();
    await page.getByRole("button", { name: "Stop alerts" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Alerts stopped" })).toBeVisible();
    const rows = await db()<{ id: string; f: string }[]>`select id, alert_frequency as f from saved_searches where user_id = ${user.id}`;
    expect(rows.find((r) => r.id === a.id)?.f).toBe("off");
    expect(rows.find((r) => r.id === b.id)?.f).toBe("weekly");

    await page.goto(`/alerts/unsubscribe?id=${a.id}&token=wrong${token.slice(5)}`);
    await expect(page.getByText("This link is not valid anymore")).toBeVisible();
    await db()`delete from users where id = ${user.id}`;
  });
});

test.describe("analytics and admin funnel", () => {
  test("search and listing views are recorded and the funnel shows the city", async ({ page, browser, isMobile }) => {
    test.skip(isMobile, "run once");
    await page.goto("/search?city=sacramento");
    await expect(page.getByTestId("result-count")).toBeVisible();
    const listing = await sampleListingPath("l.status = 'active' and l.city_region_id = (select id from regions where slug = 'sacramento' and type = 'city')");
    await page.goto(listing.path);
    // Leaving the page flushes the batch.
    await page.goto("/about");
    const anon = (await page.context().cookies()).find((c) => c.name === "gh_aid")?.value;
    expect(anon).toBeTruthy();
    await expect
      .poll(async () => (await db()<{ name: string }[]>`select name from events where anon_id = ${anon!} order by id`).map((e) => e.name), { timeout: 20_000 })
      .toEqual(expect.arrayContaining(["page_view", "search", "listing_view"]));
    const [view] = await db()<{ props: { city: string; listingId: string } }[]>`select props from events where anon_id = ${anon!} and name = 'listing_view'`;
    expect(view.props).toMatchObject({ city: "sacramento", listingId: listing.id });

    const admin = await browser.newPage();
    await signInAs(admin, "admin@example.com", "/admin/funnel");
    await expect(admin.getByTestId("funnel-table").locator('tr[data-city="sacramento"]')).toBeVisible();
    await admin.close();
  });
});

test("neighborhood pages show the generated summary", async ({ page }) => {
  const html = await (await page.request.get("/homes/los-angeles")).text();
  const hood = html.match(/href="\/homes\/los-angeles\/([a-z0-9-]+)"/)![1];
  await page.goto(`/homes/los-angeles/${hood}`);
  await expect(page.getByTestId("region-summary")).toContainText("The median asking price in");
});
