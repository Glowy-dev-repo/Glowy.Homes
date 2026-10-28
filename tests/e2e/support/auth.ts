import type { Page } from "@playwright/test";
import { expect } from "./fixtures";
import { SIGN_IN_LINK, uniqueEmail, waitForEmailLink } from "./mail";

/** Signs in through the real magic link flow and returns the email used. */
export async function signIn(page: Page, tag: string, callbackUrl = "/account"): Promise<string> {
  const email = uniqueEmail(tag);
  await page.goto(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign in link" }).click();
  await expect(page).toHaveURL(/\/signin\/check-email/);
  await page.goto(await waitForEmailLink(email, 15_000, SIGN_IN_LINK));
  return email;
}

/** Completes a sign in that the app already started (for example from a Save button). */
export async function finishSignIn(page: Page, tag: string): Promise<string> {
  const email = uniqueEmail(tag);
  await expect(page).toHaveURL(/\/signin\?callbackUrl=/);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign in link" }).click();
  await expect(page).toHaveURL(/\/signin\/check-email/);
  await page.goto(await waitForEmailLink(email, 15_000, SIGN_IN_LINK));
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
  return email;
}

/** Signs in as an existing account through the real magic link flow. */
export async function signInAs(page: Page, email: string, callbackUrl: string): Promise<void> {
  await page.goto(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign in link" }).click();
  await expect(page).toHaveURL(/check-email/);
  await page.goto(await waitForEmailLink(email, 15_000, SIGN_IN_LINK));
}
