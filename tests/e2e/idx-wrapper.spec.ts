// Plain Playwright: the wrapper is static HTML with no app scripts, so the hydration wait in ./support/fixtures never fires.
import { expect, test } from "@playwright/test";

test("IDX Broker wrapper serves our header and footer around the IDX content markers", async ({ request, page }) => {
  const res = await request.get("/idx-wrapper");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/html");
  expect(res.headers()["x-robots-tag"]).toContain("noindex");
  const html = await res.text();
  expect(html).toContain('<div id="idxStart"></div><div id="idxStop"></div>');

  await page.goto("/idx-wrapper");
  await expect(page.getByRole("link", { name: "Glowy Homes home" })).toBeVisible();
  await expect(page.locator("footer")).toContainText("Fair housing");
});
