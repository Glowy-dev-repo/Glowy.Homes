import { test as base, expect } from "@playwright/test";

/**
 * `page.goto` that also waits for React hydration (Providers sets html[data-hydrated]),
 * so clicks on client components are never lost to the pre hydration window.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    const goto = page.goto.bind(page);
    page.goto = async (url, options) => {
      const res = await goto(url, options);
      await page.locator("html[data-hydrated]").waitFor({ state: "attached", timeout: 15_000 });
      return res;
    };
    await use(page);
  },
});

export { expect };
