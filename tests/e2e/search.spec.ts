import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";

const countOf = async (page: Page) => {
  const text = (await page.getByTestId("result-count").textContent()) ?? "";
  return Number(text.replace(/[^\d]/g, ""));
};

async function apiTotal(page: Page, qs: string): Promise<number> {
  const res = await page.request.get(`/api/search?${qs}`);
  return ((await res.json()) as { data: { total: number } }).data.total;
}

/** A search with between 1 and 59 results (price label pins), found against the current seed. */
async function smallSearch(page: Page): Promise<string> {
  for (const city of ["san-francisco", "sacramento", "san-diego", "san-jose"]) {
    for (const priceMax of [500000, 550000, 600000, 650000, 700000, 800000]) {
      const qs = `city=${city}&propertyTypes=condo&bedsMin=2&priceMax=${priceMax}`;
      const n = await apiTotal(page, qs);
      if (n > 0 && n < 60) return qs;
    }
  }
  throw new Error("No search with 1 to 59 results in the seed");
}

test.describe("map search", () => {
  test("dragging the map updates results and URL within 500ms", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop map interaction; mobile map is covered by the toggle test");
    await page.goto("/search?city=los-angeles");
    const map = page.getByTestId("map");
    await expect(map).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
    const before = await countOf(page);

    const box = (await map.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx - 220, cy - 120, { steps: 12 });
    // Pause so the release has no velocity and MapLibre skips inertia easing.
    await page.waitForTimeout(150);

    await page.mouse.up();
    const released = Date.now();
    await page.waitForFunction(
      (prev) => {
        const count = Number((document.querySelector('[data-testid="result-count"]')?.textContent ?? "").replace(/[^\d]/g, ""));
        return location.search.includes("bounds=") && count !== prev && !document.querySelector('ul[aria-busy="true"]');
      },
      before,
      { polling: "raf", timeout: 5_000 },
    );
    const elapsed = Date.now() - released;
    expect(elapsed, `results and URL updated in ${elapsed}ms`).toBeLessThan(500);
    expect(page.url()).not.toContain("city=los-angeles");
  });

  test("clusters appear above 200 results and price pins below", async ({ page, isMobile }) => {
    test.skip(isMobile, "map shown on desktop by default");
    await page.goto("/search?city=los-angeles");
    await expect(page.getByTestId("map")).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
    expect(await countOf(page)).toBeGreaterThan(200);
    await expect(page.getByTestId("cluster").first()).toBeVisible();

    await page.goto(`/search?${await smallSearch(page)}`);
    await expect(page.getByTestId("map")).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
    const n = await countOf(page);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(60);
    await expect(page.getByTestId("cluster")).toHaveCount(0);
    await expect(page.getByTestId("price-pin")).toHaveCount(n);
  });

  test("hovering a card highlights its pin", async ({ page, isMobile }) => {
    test.skip(isMobile, "hover is a pointer interaction");
    await page.goto(`/search?${await smallSearch(page)}`);
    await expect(page.getByTestId("map")).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
    const card = page.getByTestId("listing-card").first();
    const id = await card.getAttribute("data-listing-id");
    await card.hover();
    await expect(page.locator(`[data-testid="price-pin"][data-id="${id}"]`)).toHaveClass(/is-hovered/);
  });

  test("mobile shows the list first and toggles to the map", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile layout");
    await page.goto("/search?city=san-jose");
    await expect(page.getByTestId("listing-card").first()).toBeVisible();
    await expect(page.getByTestId("map")).toHaveCount(0);
    await page.getByRole("button", { name: "Show map" }).click();
    await expect(page.getByTestId("map")).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
    await page.getByRole("button", { name: "Show list" }).click();
    await expect(page.getByTestId("listing-card").first()).toBeVisible();
  });
});

test.describe("filters", () => {
  // Each filter must change the results and survive a reload (docs/05 Phase 1 criterion 5).
  const CASES: { name: string; qs: string; base?: string }[] = [
    { name: "q", qs: "q=Unit" },
    { name: "neighborhood", qs: "" },
    { name: "bounds", qs: "bounds=-118.35,34.03,-118.25,34.09" },
    { name: "polygon", qs: "polygon=-118.35 34.03;-118.25 34.03;-118.30 34.09" },
    { name: "priceMin", qs: "priceMin=1000000" },
    { name: "priceMax", qs: "priceMax=900000" },
    { name: "bedsMin", qs: "bedsMin=4" },
    { name: "bathsMin", qs: "bathsMin=3" },
    { name: "propertyTypes", qs: "propertyTypes=condo" },
    { name: "sqftMin", qs: "sqftMin=2000" },
    { name: "sqftMax", qs: "sqftMax=900" },
    { name: "yearBuiltMin", qs: "yearBuiltMin=2010" },
    { name: "daysOnMarketMax", qs: "daysOnMarketMax=7" },
    { name: "keywords", qs: "keywords=fireplace" },
    { name: "status", qs: "status=sold" },
    { name: "pets", qs: "pets=true", base: "type=rent&city=los-angeles" },
    { name: "furnished", qs: "furnished=true", base: "type=rent&city=los-angeles" },
    { name: "laundry", qs: "laundry=true", base: "type=rent&city=los-angeles" },
    { name: "parking", qs: "parking=true", base: "type=rent&city=los-angeles" },
    { name: "availableBy", qs: "availableBy=2026-10-05", base: "type=rent&city=los-angeles" },
    { name: "type", qs: "type=rent" },
  ];

  for (const c of CASES) {
    test(`${c.name} changes results and survives reload`, async ({ page, isMobile }) => {
      test.skip(isMobile, "URL state is viewport independent; run once");
      const base = c.base ?? "city=los-angeles";
      let qs = `${base}&${c.qs}`;
      if (c.name === "neighborhood") {
        // Pick a real Los Angeles neighborhood from the city page's links.
        const html = await (await page.request.get("/homes/los-angeles")).text();
        const slug = html.match(/href="\/homes\/los-angeles\/([a-z0-9-]+)"/)![1];
        qs = `city=los-angeles&neighborhood=${slug}`;
      }
      const baseline = await apiTotal(page, base);
      await page.goto(`/search?${qs}`);
      const filtered = await countOf(page);
      expect(filtered, `${c.name} should change the count from ${baseline}`).not.toBe(baseline);
      await page.reload();
      await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
      expect(await countOf(page)).toBe(filtered);
      const param = c.name === "neighborhood" ? "neighborhood" : c.qs.split("=")[0];
      expect(new URL(page.url()).searchParams.has(param)).toBe(true);
    });
  }

  test("sort changes the order and survives reload", async ({ page, isMobile }) => {
    test.skip(isMobile, "run once");
    await page.goto("/search?city=los-angeles&sort=price_desc");
    const first = await page.getByTestId("listing-card").first().getAttribute("data-listing-id");
    await page.goto("/search?city=los-angeles&sort=price_asc");
    const cheapest = await page.getByTestId("listing-card").first().getAttribute("data-listing-id");
    expect(cheapest).not.toBe(first);
    await page.reload();
    expect(page.url()).toContain("sort=price_asc");
    await expect(page.getByTestId("listing-card").first()).toHaveAttribute("data-listing-id", cheapest!);
    await expect(page.getByLabel("Sort")).toHaveValue("price_asc");
  });

  test("desktop chips apply filters to the URL", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop chips");
    await page.goto("/search?city=sacramento");
    const before = await countOf(page);
    await page.getByRole("button", { name: "Beds" }).click();
    await page.getByRole("button", { name: "3+" }).click();
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/bedsMin=3/);
    await expect.poll(() => countOf(page)).not.toBe(before);
    await expect(page.getByRole("button", { name: "3+ bd" })).toBeVisible();
  });

  test("mobile filter sheet shows a live count and applies", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile sheet");
    await page.goto("/search?city=sacramento");
    await page.getByRole("button", { name: /^Filters/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Condo").check();
    await expect(dialog.getByRole("button", { name: /^Show [\d,]+ homes?$/ })).toBeVisible();
    await dialog.getByRole("button", { name: /^Show [\d,]+ homes?$/ }).click();
    await expect(page).toHaveURL(/propertyTypes=condo/);
    await expect(page.getByRole("button", { name: /^Filters/ })).toContainText("1");
  });

  test("no results shows the empty state with clear filters", async ({ page }) => {
    await page.goto("/search?city=san-francisco&priceMin=5000000&propertyTypes=condo");
    await expect(page.getByRole("heading", { name: "No homes match" })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page).not.toHaveURL(/priceMin/);
    await expect.poll(() => countOf(page)).toBeGreaterThan(0);
  });
});

test.describe("autocomplete and browse", () => {
  test("autocomplete groups places and navigates to the browse page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("combobox").fill("San Di");
    const option = page.getByRole("option", { name: /San Diego/ });
    await expect(option).toBeVisible();
    await expect(page.getByRole("listbox")).toContainText("Places");
    await option.click();
    await expect(page).toHaveURL(/\/homes\/san-diego$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Homes for sale in San Diego");
  });

  test("city page renders on the server with the right count, stats and 40 cards", async ({ page, request }) => {
    const html = await (await request.get("/homes/los-angeles")).text();
    const total = await apiTotal(page, "city=los-angeles");
    expect(html).toContain("Homes for sale in Los Angeles");
    expect(html).toContain(`${total.toLocaleString("en-US")} homes for sale in Los Angeles`);
    expect(html).toMatch(/The median list price is \$[\d,]+/);
    expect(html.match(/data-testid="listing-card"/g)?.length).toBe(40);
    expect(html).toContain('href="/homes/los-angeles/');
    expect(html).toContain('"@type":"BreadcrumbList"');
  });

  test("neighborhood and rental browse pages render and link internally", async ({ page }) => {
    await page.goto("/rentals/san-jose");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Rentals in San Jose");
    await page.getByRole("link", { name: "Homes for sale in San Jose" }).click();
    await expect(page).toHaveURL(/\/homes\/san-jose$/);
    const hood = page.getByRole("navigation", { name: /Neighborhoods in San Jose/ }).getByRole("link").first();
    const name = (await hood.textContent())!;
    await hood.click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Homes for sale in ${name}, San Jose`);
    expect((await page.request.get("/homes/san-jose/not-a-place")).status()).toBe(404);
  });

  test("recently viewed homes appear on the home page", async ({ page }) => {
    await page.goto("/homes/san-francisco");
    const card = page.getByTestId("listing-card").first();
    const address = (await card.getByRole("heading").textContent())!;
    await card.getByRole("link").click();
    await expect(page).toHaveURL(/\/listing\//);
    await page.goto("/");
    const recent = page.getByTestId("recently-viewed");
    await expect(recent).toBeVisible();
    await expect(recent).toContainText(address.split(",")[0]);
  });
});
