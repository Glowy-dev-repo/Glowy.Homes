import { sparkAdapter } from "../../src/lib/ingestion/adapters/spark";
import { runIngest } from "../../src/lib/ingestion/ingest";
import { db, removeListings } from "./support/db";
import { expect, test } from "./support/fixtures";

test("a Spark listing is ingested and shown on our own listing page without agent only fields", async ({ page }) => {
  const mlsNumber = `SP${Date.now()}`;
  // One listing shaped like the Spark API, served by a stand in for the API.
  const listing = {
    Id: mlsNumber,
    StandardFields: {
      ListingKey: mlsNumber,
      ListingId: mlsNumber,
      ModificationTimestamp: new Date().toISOString(),
      OnMarketDate: new Date().toISOString().slice(0, 10),
      StandardStatus: "Active",
      ListPrice: 876_000,
      PublicRemarks: "Quiet street, big backyard and a new roof.",
      PrivateRemarks: "Lockbox code 4321",
      PropertyType: "A",
      PropertySubType: "Single Family Residence",
      // Outside the demo market, so no city page, search or other test ever sees it.
      UnparsedFirstLineAddress: `${Date.now() % 100000} Spark Test Ave`,
      City: "RENO",
      StateOrProvince: "NV",
      PostalCode: "89501",
      Latitude: 39.5296,
      Longitude: -119.8138,
      BedsTotal: 3,
      BathsFull: 2,
      BuildingAreaTotal: 1650,
      ListAgentName: "Dana Reyes",
      ListOfficeName: "Coastal Realty",
      Photos: [{ Primary: true, Privacy: "Public", Uri1600: "https://cdn.resize.sparkplatform.com/demo/1600x1200/true/a-o.jpg" }],
    },
  };
  const fake = (async (url: string) => {
    const u = new URL(url);
    if (u.pathname === "/v1/propertytypes") return Response.json({ D: { Success: true, Results: [{ MlsCode: "A", PropertyClass: "Residential" }] } });
    return Response.json({ D: { Success: true, Results: [listing], Pagination: { TotalPages: 1, CurrentPage: 1 } } });
  }) as typeof fetch;

  const result = await runIngest(db(), sparkAdapter({ token: "t", fetchImpl: fake }), { cursor: null });
  expect(result.stats).toMatchObject({ created: 1, errors: 0 });

  const [row] = await db()<{ id: string }[]>`select id from listings where source = 'spark' and source_listing_id = ${mlsNumber}`;
  try {
    await page.goto(`/listing/${row.id}`);
    await expect(page.getByText("$876,000").first()).toBeVisible();
    await expect(page.getByTestId("listed-by")).toContainText("Listed by Dana Reyes of Coastal Realty");
    await expect(page.locator('img[src^="https://cdn.resize.sparkplatform.com/"]').first()).toBeAttached();
    await expect(page.getByText("Quiet street, big backyard")).toBeVisible();
    await expect(page.getByText("Reno").first()).toBeVisible();
    expect(await page.content()).not.toContain("Lockbox");
  } finally {
    await removeListings([row.id]);
  }
});
