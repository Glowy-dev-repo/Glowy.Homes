import { simplyRetsAdapter } from "../../src/lib/ingestion/adapters/simplyrets";
import { runIngest } from "../../src/lib/ingestion/ingest";
import { db, removeListings } from "./support/db";
import { expect, test } from "./support/fixtures";

test("a SimplyRETS listing is ingested and shown on our own listing page without agent only fields", async ({ page }) => {
  const mlsNumber = `SR${Date.now()}`;
  // One property shaped like the SimplyRETS API, served by a stand in for the API.
  const property = {
    mlsId: Number(Date.now() % 1_000_000_000),
    listingId: mlsNumber,
    modified: new Date().toISOString(),
    listDate: new Date().toISOString(),
    listPrice: 987_000,
    remarks: "Sunny single level home with a big yard.",
    privateRemarks: "Lockbox code 4321",
    showingInstructions: "Text the agent before showing",
    photos: ["https://d2bd5h5te3s67r.cloudfront.net/trial/home9.jpg"],
    // Outside the demo market, so no city page, search or other test ever sees it.
    address: { full: `${Date.now() % 100000} Feed Test Ave`, city: "Reno", state: "Nevada", postalCode: "89501" },
    geo: { lat: 39.5296, lng: -119.8138 },
    mls: { status: "Active" },
    property: { type: "RES", subType: "SingleFamilyResidence", bedrooms: 3, bathsFull: 2, area: 1650, yearBuilt: 1987 },
    agent: { firstName: "Dana", lastName: "Reyes", contact: { office: "(805) 555-0100" } },
    office: { name: "Coastal Realty", contact: { office: "(805) 555-0199" } },
  };
  let served = false;
  const fake = (async () => {
    const body = served ? [] : [property];
    served = true;
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;

  const result = await runIngest(db(), simplyRetsAdapter({ key: "k", secret: "s", fetchImpl: fake }), { cursor: null });
  expect(result.stats).toMatchObject({ created: 1, errors: 0 });

  const [row] = await db()<{ id: string }[]>`select id from listings where source = 'simplyrets' and source_listing_id = ${mlsNumber}`;
  try {
    await page.goto(`/listing/${row.id}`);
    await expect(page.getByText("$987,000").first()).toBeVisible();
    await expect(page.getByTestId("listed-by")).toContainText("Listed by Dana Reyes of Coastal Realty");
    await expect(page.locator('img[src^="https://d2bd5h5te3s67r.cloudfront.net/"]').first()).toBeAttached();
    await expect(page.getByText("Sunny single level home")).toBeVisible();
    const html = await page.content();
    expect(html).not.toContain("Lockbox");
    expect(html).not.toContain("Text the agent before showing");
  } finally {
    await removeListings([row.id]);
  }
});
