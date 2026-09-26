import { describe, expect, it } from "vitest";
import { normalizeAddress, normalizePostalCode } from "@/lib/ingestion/address";
import { planListingEvents } from "@/lib/ingestion/events";
import { syntheticAdapter } from "@/lib/ingestion/adapters/synthetic";
import type { NormalizedListing } from "@/lib/ingestion/types";

const base: NormalizedListing = {
  sourceListingId: "GH1",
  sourceUpdatedAt: "2026-09-01T12:00:00.000Z",
  listingType: "sale",
  status: "active",
  price: 900000,
  originalPrice: 950000,
  listDate: "2026-08-01",
  statusDate: "2026-09-01",
  address: { line1: "12 Maple Ave", city: "Los Angeles", regionCode: "ON", postalCode: "M5V 1A1", country: "CA" },
  location: { lat: 43.6, lng: -79.4 },
  propertyType: "detached",
  facts: {},
  features: { interior: [], exterior: [], building: [], community: [] },
  media: [],
};

describe("address normalization", () => {
  it("uppercases, strips punctuation, expands abbreviations and folds units", () => {
    expect(normalizeAddress("12 Maple Ave.", "Apt #4")).toBe("12 MAPLE AVENUE UNIT 4");
    expect(normalizeAddress("12 maple avenue", "Unit 4")).toBe("12 MAPLE AVENUE UNIT 4");
    expect(normalizeAddress("88 King St W")).toBe("88 KING STREET WEST");
    expect(normalizeAddress("5 Côte Rd")).toBe("5 COTE ROAD");
  });

  it("formats Canadian postal codes", () => {
    expect(normalizePostalCode("m5v1a1")).toBe("M5V 1A1");
    expect(normalizePostalCode("M5V-1A1")).toBe("M5V 1A1");
  });

  it("formats US ZIP codes", () => {
    expect(normalizePostalCode("94110")).toBe("94110");
    expect(normalizePostalCode("941101234")).toBe("94110-1234");
    expect(normalizePostalCode("94110-1234")).toBe("94110-1234");
    expect(normalizePostalCode("90210")).toBe("90210");
  });
});

describe("price history planning", () => {
  it("uses feed history for new listings", () => {
    const events = planListingEvents(null, { ...base, history: [{ eventType: "listed", price: 950000, date: "2026-08-01" }, { eventType: "price_change", price: 900000, date: "2026-08-20" }] });
    expect(events.map((e) => e.eventType)).toEqual(["listed", "price_change"]);
  });

  it("synthesizes listed plus the closing event when a feed has no history", () => {
    const events = planListingEvents(null, { ...base, status: "sold", soldPrice: 920000, soldDate: "2026-09-10" });
    expect(events).toEqual([
      { eventType: "listed", price: 950000, date: "2026-08-01" },
      { eventType: "sold", price: 920000, date: "2026-09-10" },
    ]);
  });

  it("records only real changes for existing listings", () => {
    expect(planListingEvents({ status: "active", price: 900000 }, base)).toEqual([]);
    expect(planListingEvents({ status: "active", price: 950000 }, base)).toEqual([{ eventType: "price_change", price: 900000, date: "2026-09-01" }]);
    expect(planListingEvents({ status: "active", price: 900000 }, { ...base, status: "pending" }).map((e) => e.eventType)).toEqual(["pending"]);
    expect(planListingEvents({ status: "withdrawn", price: 900000 }, base).map((e) => e.eventType)).toEqual(["relisted"]);
  });

  it("does not add a price change on the closing event", () => {
    const events = planListingEvents({ status: "pending", price: 900000 }, { ...base, status: "sold", price: 900000, soldPrice: 880000, soldDate: "2026-09-12" });
    expect(events).toEqual([{ eventType: "sold", price: 880000, date: "2026-09-12" }]);
  });
});

describe("synthetic adapter", () => {
  it("validates records and inlines synthetic media", () => {
    const adapter = syntheticAdapter("missing.jsonl");
    expect(adapter.normalize({ ...base })).toMatchObject({ sourceListingId: "GH1" });
    expect(() => adapter.normalize({ ...base, price: -1 })).toThrow();
    const media = adapter.inlineMedia("synthetic://GH0000001/3");
    expect(media?.storageKey).toBe("synthetic/GH0000001/3");
    expect(media?.blurDataUrl).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(adapter.inlineMedia("https://example.com/a.jpg")).toBeNull();
  });
});
