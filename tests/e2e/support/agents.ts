import type { Page } from "@playwright/test";
import { expect } from "./fixtures";

/** An 8 digit DRE number no other test account uses (one working account per license). */
export const uniqueLicense = () => String(Math.floor(Math.random() * 1e8)).padStart(8, "0");

/** Fills the partner agent wizard at /pro/join (the page must be open) and submits it. */
export async function fillAgentWizard(page: Page, opts: { name: string; license: string; city?: string; agree?: boolean }): Promise<void> {
  const city = opts.city ?? "Moorpark";
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Name clients will see").fill(opts.name);
  await page.getByLabel("California DRE license number").fill(opts.license);
  await page.getByLabel("Business phone").fill("213 555 0199");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByTestId("zip-picker").getByText(city, { exact: true }).click();
  await page.getByLabel(`All ZIP codes in ${city}`).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Review" })).toBeVisible();
  if (opts.agree !== false) await page.getByLabel(/I have read and accept the partner agreement/).check();
  await page.getByRole("button", { name: "Create my profile" }).click();
}
