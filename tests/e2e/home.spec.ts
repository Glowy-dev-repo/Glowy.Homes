import { expect, test } from "./support/fixtures";

test.describe("home page shell", () => {
  test("renders header, hero search and footer", async ({ page, isMobile }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Glowy Homes/);
    await expect(page.getByRole("banner").getByRole("link", { name: /Glowy Homes home/ })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const tabs = page.getByRole("tablist", { name: "Search type" });
    await expect(tabs.getByRole("tab", { name: "Buy" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("combobox")).toBeVisible();

    if (isMobile) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await expect(page.getByRole("dialog").getByRole("link", { name: "Rent" })).toBeVisible();
      await page.getByRole("button", { name: "Close menu" }).click();
    } else {
      await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Home value" })).toBeVisible();
    }

    const footer = page.getByRole("contentinfo");
    await expect(footer).toContainText("fair housing");
    await expect(footer.getByRole("link", { name: "Los Angeles" })).toHaveAttribute("href", "/homes/los-angeles");
  });

  test("hero search submits the selected mode", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("combobox").fill("Los Angeles");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/\/search\?type=sale&q=Los(\+|%20)Angeles/);

    await page.goto("/");
    await page.getByRole("tab", { name: "Home value" }).click();
    await page.getByRole("combobox").fill("12 Maple Ave");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/\/home-value\?address=12\+Maple\+Ave/);
  });

  test("has canonical, description and Open Graph image", async ({ page }) => {
    await page.goto("/");
    // Canonical is the configured site origin (NEXT_PUBLIC_APP_URL), with or without a trailing slash.
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https?:\/\/[^/]+\/?$/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.+/);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /opengraph-image/);
  });
});
