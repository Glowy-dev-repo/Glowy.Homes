import { describe, expect, it } from "vitest";
import { normalizeSpark, sparkAdapter, type SparkListing } from "@/lib/ingestion/adapters/spark";

// Shaped like a Spark /v1/listings result (StandardFields plus the Id and property class added while paging).
const sample: SparkListing & Record<string, unknown> = {
  Id: "20261001120000000000000000",
  PropertyClass: "Residential",
  ListingKey: "20261001120000000000000000",
  ListingId: "226001234",
  ModificationTimestamp: "2026-10-01T10:57:26-07:00",
  OnMarketDate: "2026-09-20",
  StandardStatus: "Active",
  ListPrice: 1250000,
  OriginalListPrice: 1299000,
  ClosePrice: 1200000,
  CloseDate: "2026-10-01",
  PublicRemarks: "Bright home near the park.",
  PrivateRemarks: "Lockbox code 1234",
  ShowingInstructions: "Call listing agent first",
  PropertyType: "A",
  PropertySubType: "Single Family Residence",
  StreetNumber: "123",
  StreetName: "Main",
  StreetSuffix: "St",
  City: "MOORPARK",
  StateOrProvince: "CA",
  PostalCode: "93021",
  Latitude: 34.28,
  Longitude: -118.88,
  BedsTotal: 3,
  BathsFull: 2,
  BathsHalf: 1,
  BathsThreeQuarter: "********",
  BuildingAreaTotal: 1800,
  LotSizeAcres: 0.25,
  YearBuilt: 1998,
  GarageSpaces: 2,
  AssociationFee: 150,
  TaxAnnualAmount: 9800,
  SubdivisionName: "Mountain Meadows",
  InternetAddressDisplayYN: false,
  ListAgentFirstName: "Dana",
  ListAgentLastName: "Reyes",
  ListAgentPreferredPhone: "805-555-0100",
  ListAgentStateLicense: "01234567",
  ListOfficeName: "Coastal Realty",
  ListOfficePhone: "805-555-0199",
  CoListAgentName: "Sam Lee",
  Photos: [
    { Primary: false, Privacy: "Public", Uri1600: "https://cdn.resize.sparkplatform.com/x/1600x1200/true/b-o.jpg", Caption: "Kitchen" },
    { Primary: true, Privacy: "Public", Uri1600: "https://cdn.resize.sparkplatform.com/x/1600x1200/true/a-o.jpg" },
    { Primary: false, Privacy: "Private", Uri1600: "https://cdn.resize.sparkplatform.com/x/1600x1200/true/private-o.jpg" },
    { Primary: false, Privacy: "Public", Uri1600: "javascript:alert(1)" },
  ],
};

describe("Spark listing to our listing", () => {
  it("maps the facts, price, address, attribution and display choices", () => {
    const l = normalizeSpark(sample);
    expect(l).toMatchObject({
      sourceListingId: "226001234",
      sourceUpdatedAt: "2026-10-01T17:57:26.000Z",
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
      agent: { name: "Dana Reyes", phone: "805-555-0100", licenseNumber: "01234567", brokerage: "Coastal Realty", officePhone: "805-555-0199", coAgentName: "Sam Lee" },
      display: { internet: undefined, address: false },
    });
    expect(l.facts).toMatchObject({ mls_number: "226001234", subdivision: "Mountain Meadows" });
    expect(l.soldPrice).toBeUndefined();
  });

  it("never keeps agent only fields, private photos or unsafe links, and puts the main photo first", () => {
    const l = normalizeSpark(sample);
    const text = JSON.stringify(l);
    expect(text).not.toContain("Lockbox");
    expect(text).not.toContain("Call listing agent first");
    expect(l.media.map((m) => m.url)).toEqual([
      "https://cdn.resize.sparkplatform.com/x/1600x1200/true/a-o.jpg",
      "https://cdn.resize.sparkplatform.com/x/1600x1200/true/b-o.jpg",
    ]);
    expect(l.media[1].caption).toBe("Kitchen");
  });

  it("treats masked fields as missing, so the listing waits for a location from its address", () => {
    const l = normalizeSpark({ ...sample, Latitude: "********", Longitude: "********", BedsTotal: "********", ListPrice: 900000 });
    expect(l.location).toBeUndefined();
    expect(l.beds).toBeUndefined();
    expect(JSON.stringify(l)).not.toContain("********");
  });

  it("maps sold listings, rentals and statuses written with spaces", () => {
    expect(normalizeSpark({ ...sample, StandardStatus: "Closed" })).toMatchObject({ status: "sold", soldPrice: 1200000, soldDate: "2026-10-01" });
    expect(normalizeSpark({ ...sample, StandardStatus: "Active Under Contract" }).status).toBe("pending");
    expect(normalizeSpark({ ...sample, StandardStatus: "Canceled" }).status).toBe("withdrawn");
    const rent = normalizeSpark({ ...sample, PropertyClass: "Rental", ListPrice: 4200, StandardStatus: "Closed" });
    expect(rent).toMatchObject({ listingType: "rent", status: "leased", price: 4200 });
    expect(normalizeSpark({ ...sample, PropertyClass: "Land", PropertySubType: null }).propertyType).toBe("land");
    expect(normalizeSpark({ ...sample, PropertySubType: "Townhouse" }).propertyType).toBe("townhouse");
  });
});

describe("Spark feed paging", () => {
  it("reads the property classes, pages in ListingKey order and asks only for changes since the cursor", async () => {
    const urls: URL[] = [];
    const listing = (key: string, modified: string) => ({ Id: key, StandardFields: { ListingKey: key, ListingId: key, ModificationTimestamp: modified, PropertyType: "B" } });
    const pages = [
      [listing("1", "2026-10-01T00:00:00Z"), listing("2", "2026-10-03T00:00:00Z")],
      [listing("3", "2026-10-02T00:00:00Z")],
    ];
    const fake = (async (url: string, init?: RequestInit) => {
      const u = new URL(url);
      urls.push(u);
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer tok");
      if (u.pathname === "/v1/propertytypes") return Response.json({ D: { Success: true, Results: [{ MlsCode: "B", PropertyClass: "Rental" }] } });
      const page = Number(u.searchParams.get("_page"));
      return Response.json({ D: { Success: true, Results: pages[page - 1] ?? [], Pagination: { TotalPages: 2, CurrentPage: page } } });
    }) as typeof fetch;
    const adapter = sparkAdapter({ token: "tok", fetchImpl: fake });
    const got: { keys: unknown[]; cursor: string | null; cls: unknown }[] = [];
    for await (const page of adapter.fetchChanged("2026-09-30T00:00:00.000Z", 1000))
      got.push({ keys: page.items.map((i) => i.ListingKey), cursor: page.nextCursor, cls: page.items[0].PropertyClass });

    expect(got).toEqual([
      { keys: ["1", "2"], cursor: "2026-10-03T00:00:00.000Z", cls: "Rental" },
      { keys: ["3"], cursor: "2026-10-02T00:00:00.000Z", cls: "Rental" },
    ]);
    const first = urls.find((u) => u.pathname === "/v1/listings")!;
    expect(first.searchParams.get("_filter")).toBe("ModificationTimestamp Gt 2026-09-30T00:00:00Z");
    expect(first.searchParams.get("_orderby")).toBe("+ListingKey");
    expect(first.searchParams.get("_expand")).toBe("Photos");
    // A standard key never asks for more than 25 a page.
    expect(first.searchParams.get("_limit")).toBe("25");
    expect(urls.filter((u) => u.pathname === "/v1/listings")).toHaveLength(2);
  });

  it("stops with an error Spark reports, instead of saving a cursor past missed listings", async () => {
    const fake = (async () => Response.json({ D: { Success: false, Message: "Token expired" } }, { status: 401 })) as unknown as typeof fetch;
    const adapter = sparkAdapter({ token: "tok", fetchImpl: fake });
    await expect(async () => {
      for await (const _ of adapter.fetchChanged(null, 25)) void _;
    }).rejects.toThrow("Spark 401: Token expired");
  });

  it("only uses photos from Spark's CDN", () => {
    const adapter = sparkAdapter({ token: "tok" });
    const url = "https://cdn.resize.sparkplatform.com/x/1600x1200/true/a-o.jpg";
    expect(adapter.inlineMedia(url)?.storageKey).toBe(url);
    expect(adapter.inlineMedia("https://evil.example/a.jpg")).toBeNull();
  });
});
