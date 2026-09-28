import type { Page } from "@playwright/test";
import sharp from "sharp";
import { signIn } from "./support/auth";
import { db, sampleListingPath } from "./support/db";
import { expect, test } from "./support/fixtures";
import { waitForEmailLink } from "./support/mail";

// docs/05 Phase 5 acceptance criteria 1 to 4, as one landlord and one renter going through the real UI.

async function photo(i: number) {
  const buffer = await sharp({ create: { width: 1200, height: 800, channels: 3, background: { r: 40 + i * 50, g: 120, b: 200 - i * 40 } } }).jpeg().toBuffer();
  return { name: `room-${i}.jpg`, mimeType: "image/jpeg", buffer };
}

async function signInAs(page: Page, email: string, callbackUrl: string) {
  await page.goto(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign in link" }).click();
  await expect(page).toHaveURL(/check-email/);
  await page.goto(await waitForEmailLink(email));
}

/** A Los Angeles condo with no owner and nothing listed, so the landlord can list it. */
async function freeCondo() {
  const [p] = await db()<{ id: string; line1: string; line2: string; city: string; lat: number; lng: number }[]>`
    select p.id, p.address_line1 as line1, p.address_line2 as line2, p.city,
      ST_Y(p.location::geometry) as lat, ST_X(p.location::geometry) as lng
    from properties p join regions c on c.id = p.city_region_id and c.slug = 'los-angeles'
    where p.property_type = 'condo' and p.address_line2 is not null and p.owner_user_id is null
      and not exists (select 1 from listings l where l.property_id = p.id and l.status in ('active', 'pending', 'in_review'))
    order by random() limit 1`;
  return p;
}

test.describe("rentals and user listings", () => {
  test("landlord lists, admin approves, renter applies twice with one application, landlord updates status", async ({ page, browser, isMobile }) => {
    test.skip(isMobile, "one marketplace flow per run; the wizard itself is covered on mobile below");
    test.setTimeout(240_000);
    const home = await freeCondo();
    const street = `${home.line2} ${home.line1}`;

    await test.step("landlord fills the wizard; two photos are refused in the browser", async () => {
      await signIn(page, "landlord", "/landlord/listings/new");
      await expect(page.getByRole("heading", { name: "List a rental" })).toBeVisible();
      await page.getByLabel("Street address and city").fill(`${home.line2}, ${home.line1}, ${home.city}`);
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByRole("heading", { name: "Facts" })).toBeVisible();
      await page.getByLabel("Bedrooms").fill("2");
      await page.getByLabel("Bathrooms").fill("1");
      await page.getByLabel(/Interior size/).fill("780");
      await page.getByRole("button", { name: "Continue" }).click();

      await expect(page.getByRole("heading", { name: "Photos" })).toBeVisible();
      await page.getByTestId("photo-input").setInputFiles([await photo(1), await photo(2)]);
      await expect(page.getByTestId("photo-count")).toContainText("2 of 3 photos ready");
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByRole("alert").filter({ hasText: "Add at least 3 photos" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Photos" })).toBeVisible();

      await page.getByTestId("photo-input").setInputFiles([await photo(3)]);
      await expect(page.getByTestId("photo-count")).toContainText("3 of 3 photos ready");
      await page.getByRole("button", { name: "Continue" }).click();

      await page.getByLabel("Monthly rent ($)").fill("2550");
      await page.getByLabel("Available from").fill("2026-11-01");
      await page.getByLabel("Pets allowed").check();
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByLabel("Description").fill("Bright two bedroom condo with a south facing balcony, steps to the subway and the waterfront trail.");
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByRole("heading", { name: "Contact" })).toBeVisible();
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByRole("heading", { name: "Review" })).toBeVisible();
      await page.getByRole("button", { name: "Submit for review" }).click();
      await expect(page.getByTestId("listing-submitted")).toContainText("Submitted for review");
    });

    const [listing] = await db()<{ id: string; status: string; photos: number }[]>`
      select l.id, l.status, (select count(*)::int from listing_media m where m.listing_id = l.id) as photos
      from listings l where l.property_id = ${home.id} order by l.created_at desc limit 1`;
    expect(listing).toMatchObject({ status: "in_review", photos: 3 });

    await test.step("the server refuses two photos too", async () => {
      const [m] = await db()<{ storage_key: string }[]>`select storage_key from listing_media where listing_id = ${listing.id} limit 1`;
      const res = await page.request.post("/api/listings", {
        data: {
          listingType: "rent", propertyId: home.id, propertyType: "condo", beds: 2, baths: 1, sqft: 780, price: 2550,
          description: "Bright two bedroom condo with a south facing balcony, steps to the subway.", availableDate: "2026-11-01",
          rentalTerms: { pets: true, furnished: false, laundry: "In suite", parking: false, leaseMinMonths: 12, deposit: 2550 },
          photos: [{ storageKey: m.storage_key }, { storageKey: m.storage_key }],
          contact: { preferred: "email" },
        },
      });
      expect(res.status()).toBe(400);
      expect(JSON.stringify(await res.json())).toContain("Add at least 3 photos");
    });

    await test.step("admin approves and the listing shows in rental search within 5 minutes", async () => {
      const admin = await browser.newPage();
      await signInAs(admin, "admin@example.com", "/admin/moderation");
      const item = admin.getByTestId("moderation-item").filter({ hasText: street });
      await item.getByRole("button", { name: "Approve" }).click();
      await expect(admin.getByTestId("moderation-item").filter({ hasText: street })).toHaveCount(0);
      await admin.close();
      const approvedAt = Date.now();

      const d = 0.002;
      const bounds = [home.lng - d, home.lat - d, home.lng + d, home.lat + d].map((n) => n.toFixed(5)).join(",");
      await expect
        .poll(async () => {
          const res = await page.request.get(`/api/search?type=rent&bounds=${bounds}`);
          return ((await res.json()) as { data: { items: { id: string }[] } }).data.items.map((i) => i.id);
        }, { timeout: 60_000 })
        .toContain(listing.id);
      expect(Date.now() - approvedAt).toBeLessThan(5 * 60_000);

      await page.goto("/landlord");
      await expect(page.getByTestId("owner-listing").filter({ hasText: street })).toHaveAttribute("data-status", "active");
    });

    const renter = await browser.newPage();
    let renterEmail = "";
    const own = await sampleListingPath(`l.id = '${listing.id}'`);
    const other = await sampleListingPath("l.listing_type = 'rent' and l.status = 'active' and l.owner_user_id is null");

    await test.step("renter fills one application and sends it to two rentals without retyping", async () => {
      renterEmail = await signIn(renter, "renter", "/account/application");
      const form = renter.locator("form");
      await form.getByLabel("Full name").fill("Sam Rivera");
      await form.getByLabel("Phone").fill("416 555 0199");
      await form.getByLabel("Move in date").fill("2026-11-01");
      await form.getByLabel("People who will live there").fill("2");
      await form.getByLabel("Household income ($ per year)").fill("92000");
      await form.getByRole("button", { name: "Save application" }).click();
      await expect(renter.getByRole("status").filter({ hasText: "Application saved." })).toBeVisible();

      for (const target of [own, other]) {
        await renter.goto(target.path);
        if (target === own) await expect(renter.getByTestId("owner-card")).toContainText("Rented directly by the landlord");
        await renter.getByRole("button", { name: "Apply", exact: true }).click();
        const dialog = renter.getByRole("dialog");
        await expect(dialog).toContainText("Send the application for Sam Rivera?");
        await dialog.getByRole("button", { name: "Send application" }).click();
        await expect(dialog.getByRole("status")).toContainText("Application sent");
      }

      const subs = await db()<{ application_id: string }[]>`
        select s.application_id from rental_application_submissions s where s.listing_id in (${own.id}, ${other.id})
          and s.application_id in (select a.id from rental_applications a join users u on u.id = a.applicant_user_id where u.email = ${renterEmail})`;
      expect(subs).toHaveLength(2);
      expect(subs[0].application_id).toBe(subs[1].application_id);
    });

    await test.step("landlord sees the application, approves it, and the renter sees the new status", async () => {
      await page.goto("/landlord");
      await page.getByRole("tab", { name: /Applications/ }).click();
      const app = page.getByTestId("landlord-application").filter({ hasText: "Sam Rivera" }).first();
      await expect(app).toContainText("$92,000");
      await app.getByLabel("Status for Sam Rivera").selectOption("approved");
      await expect(page.getByRole("status").filter({ hasText: "Application updated." })).toBeVisible();

      await renter.goto("/account/applications");
      const mine = renter.getByTestId("my-submission").filter({ hasText: home.line1 });
      await expect(mine.getByTestId("submission-status")).toHaveText("Approved");
      await expect(renter.getByTestId("my-submission").filter({ hasNotText: home.line1 }).first().getByTestId("submission-status")).toHaveText("Sent");
    });
    await renter.close();
  });

  test("rental listing wizard fits a phone and validates the address step", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile layout check");
    await signIn(page, "landlord-mobile", "/landlord/listings/new");
    await expect(page.getByRole("heading", { name: "List a rental" })).toBeVisible();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("Street address and city")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("heading", { name: "Address" })).toBeVisible();
  });

  test("the feature option is hidden without Stripe", async ({ page, isMobile }) => {
    test.skip(isMobile || !!process.env.STRIPE_SECRET_KEY, "only meaningful without Stripe keys");
    await signIn(page, "nostripe", "/landlord");
    await expect(page.getByRole("heading", { name: "My listings" })).toBeVisible();
    await expect(page.getByText(/Feature this listing/)).toHaveCount(0);
  });
});
