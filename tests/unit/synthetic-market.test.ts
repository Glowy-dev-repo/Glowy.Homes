import { describe, expect, it } from "vitest";
import { generateMarket, pointInRing } from "@/lib/ingestion/synthetic/generate";
import { CITY_DEFS } from "@/lib/ingestion/synthetic/market";
import { marketIndex, trueValue } from "@/lib/ingestion/synthetic/model";
import { NormalizedListingSchema } from "@/lib/ingestion/types";
import { Rng } from "@/lib/random";

const asOf = new Date("2026-09-26T00:00:00Z");
const market = generateMarket({ seed: 7, total: 2000, asOf });

describe("synthetic market generator", () => {
  it("is deterministic for a seed", () => {
    const again = generateMarket({ seed: 7, total: 2000, asOf });
    expect(again.listings.slice(0, 50)).toEqual(market.listings.slice(0, 50));
    const other = generateMarket({ seed: 8, total: 2000, asOf });
    expect(other.listings[0]).not.toEqual(market.listings[0]);
  });

  it("hits the exact splits from docs/05 Phase 1", () => {
    const rent = market.listings.filter((l) => l.listingType === "rent");
    expect(market.listings).toHaveLength(2000);
    expect(rent).toHaveLength(600);
    const sale = market.listings.filter((l) => l.listingType === "sale");
    expect(sale.filter((l) => l.status === "active")).toHaveLength(840);
    expect(sale.filter((l) => l.status === "pending")).toHaveLength(210);
    expect(sale.filter((l) => l.status === "sold")).toHaveLength(350);
    expect(rent.filter((l) => l.status === "leased")).toHaveLength(150);
    expect(market.pros).toHaveLength(200);
  });

  it("emits valid, unique, in bounds records sorted by update time", () => {
    const keys = new Set<string>();
    for (const l of market.listings) {
      NormalizedListingSchema.parse(l);
      keys.add(`${l.address.line1}|${l.address.line2 ?? ""}|${l.address.postalCode}`);
      const city = CITY_DEFS.find((c) => c.name === l.address.city)!;
      expect(pointInRing([l.location!.lng, l.location!.lat], city.boundary)).toBe(true);
      expect(l.media.length).toBeGreaterThanOrEqual(5);
      expect(l.media.length).toBeLessThanOrEqual(20);
      expect(l.description).not.toMatch(/[–—]| - /);
    }
    expect(keys.size).toBe(2000);
    const times = market.listings.map((l) => l.sourceUpdatedAt);
    expect([...times].sort()).toEqual(times);
  });

  it("sold listings close within 24 months and carry history", () => {
    for (const l of market.listings.filter((x) => x.status === "sold")) {
      const days = (asOf.getTime() - Date.parse(l.soldDate!)) / 86_400_000;
      expect(days).toBeLessThanOrEqual(731);
      expect(l.history?.at(-1)?.eventType).toBe("sold");
    }
  });
});

describe("hidden pricing model", () => {
  const city = CITY_DEFS[0];
  it("grows with the market and with size", () => {
    expect(marketIndex(city, new Date("2026-06-01"))).toBeGreaterThan(marketIndex(city, new Date("2024-06-01")));
    const input = { propertyType: "detached" as const, sqft: 1500, beds: 3, baths: 2, yearBuilt: 1990, lotSqft: 4000, neighborhoodFactor: 1 };
    expect(trueValue(city, { ...input, sqft: 2500 }, asOf)).toBeGreaterThan(trueValue(city, input, asOf));
  });
});

describe("Rng", () => {
  it("weighted picks respect weights", () => {
    const rng = new Rng(1);
    let a = 0;
    for (let i = 0; i < 10_000; i++) if (rng.weighted({ a: 3, b: 1 }) === "a") a++;
    expect(a / 10_000).toBeGreaterThan(0.72);
    expect(a / 10_000).toBeLessThan(0.78);
  });
});
