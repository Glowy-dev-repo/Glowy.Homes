import { finishSignIn, signIn } from "./support/auth";
import { db, sampleListingPath } from "./support/db";
import { expect, test } from "./support/fixtures";

test.describe("listing detail page", () => {
  test("HTML contains price, address, facts and description without JavaScript", async ({ request }) => {
    const { path } = await sampleListingPath();
    const html = await (await request.get(path)).text();
    const [row] = await db()`
      select l.price, l.beds::float8 as beds, l.baths::float8 as baths, l.sqft, l.description, p.address_line1
      from listings l join properties p on p.id = l.property_id where l.id = ${path.split("/")[2]}`;
    expect(html).toContain(`$${Number(row.price).toLocaleString("en-US")}`);
    expect(html).toContain(row.address_line1);
    expect(html).toContain(`${row.beds} bd`);
    expect(html).toContain(`${row.baths} ba`);
    expect(html).toContain(`${Number(row.sqft).toLocaleString("en-US")} sq ft`);
    expect(html).toContain(row.description.slice(0, 60));
    expect(html).toContain('"@type":"RealEstateListing"');
  });

  test("sections render in the docs/01 order and similar homes shows 6", async ({ page }) => {
    const { path } = await sampleListingPath();
    await page.goto(path);
    const headings = await page.locator("main h2").allTextContents();
    const order = ["Glowy value range", "Key facts", "About this home", "Facts and features", "Price history", "Neighborhood", "Similar homes", "Listing information"];
    const positions = order.map((h) => headings.findIndex((t) => t.toLowerCase().startsWith(h.toLowerCase())));
    expect(positions.every((p) => p >= 0), JSON.stringify(headings)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    await expect(page.getByTestId("similar-homes").getByTestId("listing-card")).toHaveCount(6);
    await expect(page.getByTestId("estimate-disclaimer")).toContainText("not an appraisal");
    // MLS display rules: "Listed by" near the facts, who a request reaches, and the disclaimer.
    await expect(page.getByTestId("listed-by")).toContainText(/^Listed by .+ of .+/);
    await expect(page.getByTestId("cta-note")).toContainText("not to the listing agent");
    await expect(page.getByTestId("mls-disclaimer")).toBeVisible();
  });

  test("gallery opens full screen and moves with the keyboard", async ({ page }) => {
    const { path } = await sampleListingPath();
    await page.goto(path);
    await page.getByRole("button", { name: /See all \d+ photos/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading")).toContainText(/^1 of \d+/);
    await page.keyboard.press("ArrowRight");
    await expect(dialog.getByRole("heading")).toContainText(/^2 of \d+/);
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(dialog.getByRole("heading")).not.toContainText(/^1 of/);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("slug mismatch redirects to the canonical URL", async ({ page }) => {
    const { id, path } = await sampleListingPath();
    await page.goto(`/listing/${id}/wrong-slug`);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await page.goto(`/listing/${id}`);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  });
});

test.describe("saving", () => {
  test("saving while signed out prompts sign in and completes the save after login", async ({ page }) => {
    const { id, path } = await sampleListingPath();
    await page.goto(path);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const email = await finishSignIn(page, "save-intent");
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("button", { name: "Saved", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(async () => (await db()`select count(*)::int as n from saved_homes sh join users u on u.id = sh.user_id where u.email = ${email} and sh.listing_id = ${id}`)[0].n)
      .toBe(1);

    await page.goto("/account");
    const saved = page.getByTestId("saved-homes");
    await expect(saved.getByTestId("listing-card")).toHaveCount(1);
    await saved.getByRole("button", { name: "Remove from saved homes" }).click();
    await expect(page.getByRole("heading", { name: "No saved homes yet" })).toBeVisible();
    await expect.poll(async () => (await db()`select count(*)::int as n from saved_homes sh join users u on u.id = sh.user_id where u.email = ${email}`)[0].n).toBe(0);
  });

  test("saved search round trip: save, reload, edit frequency, delete", async ({ page }) => {
    const email = await signIn(page, "saved-search", "/search?city=sacramento&bedsMin=3");
    await expect(page).toHaveURL(/\/search\?city=sacramento&bedsMin=3/);
    await page.getByRole("button", { name: "Save search" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Sacramento 3 beds");
    await dialog.getByLabel("Email alerts").selectOption("daily");
    await dialog.getByRole("button", { name: "Save search" }).click();
    await expect(dialog.getByRole("status")).toContainText("Saved");

    const rows = () => db()`select ss.name, ss.alert_frequency, ss.filters from saved_searches ss join users u on u.id = ss.user_id where u.email = ${email}`;
    await expect.poll(async () => (await rows()).length).toBe(1);
    const [row] = await rows();
    expect(row.alert_frequency).toBe("daily");
    expect(row.filters).toMatchObject({ city: "sacramento", bedsMin: 3 });

    await page.goto("/account/searches");
    await page.reload();
    const item = page.getByTestId("saved-search");
    await expect(item).toContainText("Sacramento 3 beds");
    await item.getByLabel(/Email alerts for/).selectOption("weekly");
    await expect(page.getByRole("status")).toContainText("updated");
    await expect.poll(async () => (await rows())[0]?.alert_frequency).toBe("weekly");
    await page.reload();
    await expect(page.getByTestId("saved-search").getByLabel(/Email alerts for/)).toHaveValue("weekly");

    await page.getByRole("button", { name: "Delete Sacramento 3 beds" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("heading", { name: "No saved searches yet" })).toBeVisible();
    await expect.poll(async () => (await rows()).length).toBe(0);
  });
});

test("key pages never scroll sideways on a phone", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile layout check");
  const { path } = await sampleListingPath();
  for (const url of ["/", "/search?city=los-angeles", "/homes/los-angeles", path, "/signin"]) {
    await page.goto(url);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${url} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
  }
  await signIn(page, "overflow", "/account");
  for (const url of ["/account", "/account/searches", "/account/settings"]) {
    await page.goto(url);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${url} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
  }
});

test.describe("account", () => {
  test("settings save notification preferences", async ({ page }) => {
    const email = await signIn(page, "settings", "/account/settings");
    await page.getByLabel("Name").fill("Pat Tester");
    await page.getByLabel("Phone (optional)").fill("not a phone");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Enter a phone number with area code")).toBeVisible();
    await page.getByLabel("Phone (optional)").fill("416 555 0100");
    await page.getByLabel("Default alert frequency for new saved searches").selectOption("weekly");
    await page.getByLabel("Send me occasional news and market updates").check();
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByRole("status")).toContainText("Settings saved");
    const [u] = await db()`select name, phone, notification_prefs from users where email = ${email}`;
    expect(u).toMatchObject({ name: "Pat Tester", phone: "4165550100", notification_prefs: { saved_search: "weekly", marketing: true } });
  });

  test("recently viewed homes sync to the account", async ({ page }) => {
    const email = await signIn(page, "recent", "/");
    const { id, path } = await sampleListingPath();
    await page.goto(path);
    await expect
      .poll(async () => (await db()`select count(*)::int as n from recently_viewed rv join users u on u.id = rv.user_id where u.email = ${email} and rv.listing_id = ${id}`)[0].n, { timeout: 10_000 })
      .toBe(1);
  });
});
