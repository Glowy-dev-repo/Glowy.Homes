import { describe, expect, it } from "vitest";
import { mapPropertyType, mapStatus, normalizeSimplyRets, simplyRetsAdapter, stateCode, type SimplyRetsProperty } from "@/lib/ingestion/adapters/simplyrets";

// Shaped like a SimplyRETS sandbox property (GET /properties).
const sample: SimplyRetsProperty & Record<string, unknown> = {
  mlsId: 1005192,
  listingId: "49699701",
  modified: "2026-10-01T17:57:26.262392Z",
  listDate: "2026-09-20T18:50:30.184391Z",
  listPrice: 1250000,
  originalListPrice: 1299000,
  remarks: "Bright home near the park.",
  privateRemarks: "Lockbox code 1234",
  showingInstructions: "Call listing agent first",
  photos: ["https://d2bd5h5te3s67r.cloudfront.net/trial/home9.jpg", "http://insecure.example/a.jpg", "javascript:alert(1)"],
  virtualTourUrl: "javascript:alert(1)",
  internetEntireListingDisplay: true,
  internetAddressDisplay: false,
  address: { full: "123 Main St", city: "Moorpark", state: "California", postalCode: "93021" },
  geo: { lat: 34.28, lng: -118.88 },
  mls: { status: "Active" },
  property: {
    type: "RES",
    subType: "SingleFamilyResidence",
    bedrooms: 3,
    bathsFull: 2,
    bathsHalf: 1,
    area: 1800,
    lotSizeArea: 0.25,
    lotSizeAreaUnits: "Acres",
    yearBuilt: 1998,
    stories: 2,
    parking: { spaces: 2 },
    interiorFeatures: "High Ceiling, Island Kitchen",
    heating: "Central,Forced Air",
  },
  association: { fee: 150, amenities: "Pool,Playground" },
  tax: { taxAnnualAmount: 9800 },
  agent: { firstName: "Dana", lastName: "Reyes", contact: { office: "(805) 555-0100", email: "dana@example.com" } },
  coAgent: { firstName: "Sam", lastName: "Lee" },
  office: { name: "Coastal Realty", contact: { office: "(805) 555-0199" } },
  sales: { closePrice: 1200000, closeDate: "2026-10-01T00:00:00Z" },
};

describe("SimplyRETS listing to our listing", () => {
  it("maps the facts, price, address, attribution and display choices", () => {
    const l = normalizeSimplyRets(sample);
    expect(l).toMatchObject({
      sourceListingId: "49699701",
      listingType: "sale",
      status: "active",
      price: 1250000,
      originalPrice: 1299000,
      listDate: "2026-09-20",
      address: { line1: "123 Main St", city: "Moorpark", regionCode: "CA", postalCode: "93021", country: "US" },
      location: { lat: 34.28, lng: -118.88 },
      propertyType: "detached",
      beds: 3,
      baths: 2.5,
      sqft: 1800,
      lotSqft: 10890,
      yearBuilt: 1998,
      parkingSpaces: 2,
      hoaFee: 150,
      taxAnnual: 9800,
      description: "Bright home near the park.",
      agent: { name: "Dana Reyes", brokerage: "Coastal Realty", officePhone: "(805) 555-0199", coAgentName: "Sam Lee" },
      display: { internet: undefined, address: false },
    });
    expect(l.facts).toMatchObject({ mls_number: "49699701", heating: "Central, Forced Air" });
    expect(l.features.community).toEqual(["Pool", "Playground"]);
    expect(l.soldPrice).toBeUndefined();
  });

  it("never keeps agent only MLS fields or unsafe links", () => {
    const l = normalizeSimplyRets(sample);
    const text = JSON.stringify(l);
    expect(text).not.toContain("Lockbox");
    expect(text).not.toContain("Call listing agent first");
    expect(l.media.map((m) => m.url)).toEqual(["https://d2bd5h5te3s67r.cloudfront.net/trial/home9.jpg"]);
    expect(l.virtualTourUrl).toBeUndefined();
  });

  it("maps sold and rented listings with their close date", () => {
    const sold = normalizeSimplyRets({ ...sample, mls: { status: "Closed" } });
    expect(sold).toMatchObject({ status: "sold", soldPrice: 1200000, soldDate: "2026-10-01", statusDate: "2026-10-01" });
    const rent = normalizeSimplyRets({ ...sample, listPrice: 4200, property: { ...sample.property, type: "RNT" }, mls: { status: "Closed" } });
    expect(rent).toMatchObject({ listingType: "rent", status: "leased", price: 4200 });
    expect(rent.soldPrice).toBeUndefined();
  });

  it("hides listings that are not on the market", () => {
    expect(mapStatus("ActiveUnderContract", false)).toBe("pending");
    expect(mapStatus("Expired", false)).toBe("expired");
    for (const s of ["ComingSoon", "Hold", "Cancelled", "Delete", "Incomplete", null]) expect(mapStatus(s, false)).toBe("withdrawn");
  });

  it("maps property types and states", () => {
    expect(mapPropertyType("RES", "Condominium")).toBe("condo");
    expect(mapPropertyType("RES", "Townhouse")).toBe("townhouse");
    expect(mapPropertyType("MLF", null)).toBe("multi");
    expect(mapPropertyType("LND", null)).toBe("land");
    expect(mapPropertyType("CRE", null)).toBe("other");
    expect(stateCode("California")).toBe("CA");
    expect(stateCode("tx")).toBe("TX");
  });
});

describe("SimplyRETS feed paging", () => {
  it("pages by lastId, asks only for changes since the cursor and returns the newest change", async () => {
    const urls: string[] = [];
    const pages = [
      [{ mlsId: 1, modified: "2026-10-01T00:00:00Z" }, { mlsId: 2, modified: "2026-10-03T00:00:00Z" }],
      [{ mlsId: 3, modified: "2026-10-02T00:00:00Z" }],
    ];
    const fake = (async (url: string, init?: RequestInit) => {
      urls.push(url);
      expect(new Headers(init?.headers).get("authorization")).toBe(`Basic ${Buffer.from("k:s").toString("base64")}`);
      return new Response(JSON.stringify(pages.shift() ?? []), { status: 200 });
    }) as typeof fetch;
    const adapter = simplyRetsAdapter({ key: "k", secret: "s", fetchImpl: fake });
    const got: { n: number; cursor: string | null }[] = [];
    for await (const page of adapter.fetchChanged("2026-09-30T00:00:00.000Z", 2)) got.push({ n: page.items.length, cursor: page.nextCursor });

    expect(got).toEqual([
      { n: 2, cursor: "2026-10-03T00:00:00.000Z" },
      { n: 1, cursor: "2026-10-02T00:00:00.000Z" },
    ]);
    const first = new URL(urls[0]);
    expect(first.searchParams.get("lastId")).toBe("0");
    expect(first.searchParams.get("modified")).toBe("2026-09-30T00:00:00.000Z");
    expect(first.searchParams.getAll("status")).toContain("Closed");
    expect(new URL(urls[1]).searchParams.get("lastId")).toBe("2");
  });

  it("only uses photos from the configured CDN", () => {
    const adapter = simplyRetsAdapter({ key: "k", secret: "s" });
    expect(adapter.inlineMedia("https://d2bd5h5te3s67r.cloudfront.net/trial/home9.jpg")?.storageKey).toBe("https://d2bd5h5te3s67r.cloudfront.net/trial/home9.jpg");
    expect(adapter.inlineMedia("https://evil.example/a.jpg")).toBeNull();
  });
});
