import { expect, test } from "./support/fixtures";
import { uniqueEmail, waitForEmailLink } from "./support/mail";

test.describe("magic link sign in", () => {
  test("protected page redirects to sign in, magic link signs in and returns there", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/signin\?callbackUrl=%2Faccount/);

    const email = uniqueEmail("signin");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Email me a sign in link" }).click();
    await expect(page).toHaveURL(/\/signin\/check-email/);
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

    const link = await waitForEmailLink(email);
    // The link carries the host the request came in on, so it works against any test port.
    await page.goto(link);

    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByTestId("signed-in-as")).toContainText(email);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/signin/);
  });

  test("invalid email shows an inline error", async ({ page }) => {
    await page.goto("/signin");
    await page.getByLabel("Email").fill("not an email");
    await page.getByRole("button", { name: "Email me a sign in link" }).click();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
  });

  test("signed out visitors cannot reach admin, pro workspace or landlord areas", async ({ page }) => {
    for (const path of ["/admin", "/pro/leads", "/landlord"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/signin\?callbackUrl=/);
    }
    // The pro landing page itself stays public.
    await page.goto("/pro");
    await expect(page).toHaveURL(/\/pro$/);
  });
});
