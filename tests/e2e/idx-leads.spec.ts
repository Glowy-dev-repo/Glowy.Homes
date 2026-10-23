import type { IdxClient } from "../../src/lib/idx/client";
import { syncIdxLeads } from "../../src/lib/idx/sync-leads";
import { db } from "./support/db";
import { expect, test } from "./support/fixtures";
import { waitForEmailLink } from "./support/mail";

// Lead routing needs the Inngest dev server; the phase gate starts it next to the test build.
const INNGEST_URL = process.env.INNGEST_BASE_URL ?? "http://localhost:8288";

test("a lead from the IDX Broker search reaches the partner agent for its ZIP code and shows in admin", async ({ page, isMobile }) => {
  test.skip(isMobile, "one run is enough: the import and routing do not depend on the device");
  const [cover] = await db()<{ zip: string }[]>`
    select z.zip from pro_zip_codes z join pros p on p.id = z.pro_id
    where p.status = 'active' and p.pro_type = 'agent' and p.is_accepting_leads
    group by z.zip order by count(*) desc, z.zip limit 1`;
  test.skip(!cover, "needs a ZIP code with a partner agent");

  // A fake IDX Broker account with one new registration who saved a home in that ZIP code.
  const idxId = `e2e${Date.now()}`;
  const email = `idx-${idxId}@example.com`;
  const client: IdxClient = {
    async get(path) {
      if (path.startsWith("/leads/lead?")) {
        return { total: 1, next: null, data: [{ id: idxId, firstName: "Idx", lastName: "Buyer", email, phone: "8055550123", zipCode: "", disabled: "n", blacklisted: "n", subscribeDate: "2026-10-16 03:00:00", recentlyViewedListings: [] }] };
      }
      if (path === `/leads/property/${idxId}`) {
        return [{ id: "1", propertyName: `12 Test Way, Moorpark, CA ${cover.zip}`, property: { idxID: "a681", listingID: "E2E1", listingPrice: "900000" } }];
      }
      return null;
    },
  };

  const created: string[] = [];
  const stats = await syncIdxLeads(db(), client, { onCreated: async (id) => void created.push(id) });
  expect(stats).toMatchObject({ fetched: 1, created: 1 });
  // Running again imports nothing new.
  expect(await syncIdxLeads(db(), client)).toMatchObject({ fetched: 1, created: 0, existing: 1 });

  const res = await fetch(`${INNGEST_URL}/e/e2e`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(created.map((leadId) => ({ name: "lead/created", data: { leadId } }))),
  });
  expect(res.ok).toBe(true);

  let assigned: { pro: string | null; covers: boolean } | undefined;
  await expect
    .poll(
      async () => {
        [assigned] = await db()<{ pro: string | null; covers: boolean }[]>`
          select ld.assigned_pro_id as pro,
            exists (select 1 from pro_zip_codes z where z.pro_id = ld.assigned_pro_id and z.zip = ${cover.zip}) as covers
          from leads ld where ld.id = ${created[0]}`;
        return assigned?.pro ?? null;
      },
      { timeout: 60_000, intervals: [500, 1000] },
    )
    .not.toBeNull();
  expect(assigned!.covers).toBe(true);

  // The gate runs automatic assignment, so the lead already has its agent.
  await page.goto(`/signin?callbackUrl=${encodeURIComponent(`/admin/leads?lead=${created[0]}`)}`);
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByRole("button", { name: "Email me a sign in link" }).click();
  await expect(page).toHaveURL(/check-email/);
  await page.goto(await waitForEmailLink("admin@example.com"));
  const row = page.locator(`[data-lead-id="${created[0]}"]`).first();
  await expect(row).toContainText("Idx Buyer");
  await expect(row).toContainText(`ZIP ${cover.zip}`);
});
