import type { Page } from "@playwright/test";
import { expect } from "./fixtures";
import { SIGN_IN_LINK, signInLinkFor, uniqueEmail, waitForEmailLink } from "./mail";

/** Requests a sign in link for `email` from the sign in page and follows it. */
async function requestAndFollow(page: Page, email: string, callbackUrl: string | null): Promise<void> {
  // Pages opened with browser.newPage() skip the fixture's hydration wait; a click before it is lost.
  await page.locator("html[data-hydrated]").waitFor({ state: "attached", timeout: 15_000 });
  await page.getByLabel("Email").fill(email);
  const since = Date.now() - 1000;
  await page.getByRole("button", { name: "Email me a sign in link" }).click();
  await expect(page).toHaveURL(/\/signin\/check-email/);
  // Several tests may sign in as the same person at once: take the link sent for this page after this click.
  await page.goto(await waitForEmailLink(email, 15_000, callbackUrl ? signInLinkFor(callbackUrl) : SIGN_IN_LINK, since));
}

/** Signs in through the real magic link flow and returns the email used. */
export async function signIn(page: Page, tag: string, callbackUrl = "/account"): Promise<string> {
  const email = uniqueEmail(tag);
  await page.goto(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await requestAndFollow(page, email, callbackUrl);
  return email;
}

/** Completes a sign in that the app already started (for example from a Save button). */
export async function finishSignIn(page: Page, tag: string): Promise<string> {
  const email = uniqueEmail(tag);
  await expect(page).toHaveURL(/\/signin\?callbackUrl=/);
  await requestAndFollow(page, email, null);
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
  return email;
}

/** Signs in as an existing account through the real magic link flow. */
export async function signInAs(page: Page, email: string, callbackUrl: string): Promise<void> {
  await page.goto(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await requestAndFollow(page, email, callbackUrl);
}
