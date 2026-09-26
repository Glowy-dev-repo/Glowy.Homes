import { describe, expect, it } from "vitest";
import { parseAddress } from "@/lib/geocode";
import { selectComps } from "@/lib/valuation/engine";
import { addMonths, buildIndex, indexLookup } from "@/lib/valuation/market-index";
import { adjustComp, compsV1, compWeight, confidenceFor, weightedQuantile, type CompInput } from "@/lib/valuation/model";

const subject = { propertyType: "detached", sqft: 2000, beds: 3, baths: 2, yearBuilt: 2000 };
const flatIndex = () => 1;
const comp = (over: Partial<CompInput> = {}): CompInput => ({
  propertyId: "p",
  address: "1 Test St",
  soldPrice: 1_000_000,
  soldAt: "2026-06-01",
  distanceM: 500,
  sqft: 2000,
  beds: 3,
  baths: 2,
  yearBuilt: 2000,
  ...over,
});

describe("comps_v1 adjustments (docs/03 section 3.2)", () => {
  it("leaves an identical comp unchanged", () => {
    expect(adjustComp(subject, comp(), "2026-09-01", flatIndex)).toBeCloseTo(1_000_000);
  });

  it("adjusts for size with a 0.6 exponent, beds, baths and age", () => {
    expect(adjustComp(subject, comp({ sqft: 1000 }), "2026-09-01", flatIndex)).toBeCloseTo(1_000_000 * Math.pow(2, 0.6));
    expect(adjustComp(subject, comp({ beds: 2 }), "2026-09-01", flatIndex)).toBeCloseTo(1_030_000);
    expect(adjustComp(subject, comp({ baths: 3 }), "2026-09-01", flatIndex)).toBeCloseTo(975_000);
    expect(adjustComp(subject, comp({ yearBuilt: 1990 }), "2026-09-01", flatIndex)).toBeCloseTo(1_020_000);
  });

  it("time adjusts with the market index", () => {
    const idx = (m: string) => (m === "2026-09" ? 110 : 100);
    expect(adjustComp(subject, comp(), "2026-09-01", idx)).toBeCloseTo(1_100_000);
  });

  it("weights nearer, newer and more similar sales higher", () => {
    expect(compWeight(subject, comp({ distanceM: 200 }), 1)).toBeGreaterThan(compWeight(subject, comp({ distanceM: 4000 }), 1));
    expect(compWeight(subject, comp(), 1)).toBeGreaterThan(compWeight(subject, comp(), 11));
    expect(compWeight(subject, comp({ sqft: 3200 }), 1)).toBeLessThan(compWeight(subject, comp({ sqft: 2100 }), 1));
  });

  it("weighted median resists an outlier", () => {
    const items = [100, 101, 102, 103, 1000].map((value) => ({ value, weight: 1 }));
    expect(weightedQuantile(items, 0.5)).toBe(102);
  });
});

describe("comps_v1 estimate", () => {
  const input = (comps: CompInput[]) => ({ subject, asOf: "2026-09-01", kind: "value" as const, comps, marketIndex: flatIndex });

  it("returns insufficient data below 3 comps", async () => {
    expect(await compsV1.estimate(input([comp(), comp()]))).toMatchObject({ insufficientData: true });
  });

  it("never returns a range narrower than 4% either side", async () => {
    const r = await compsV1.estimate(input(Array.from({ length: 10 }, () => comp())));
    if ("insufficientData" in r) throw new Error("expected estimate");
    expect(r.amount).toBe(1_000_000);
    expect(r.low).toBeLessThanOrEqual(960_000);
    expect(r.high).toBeGreaterThanOrEqual(1_040_000);
    expect(r.confidence).toBe("high");
  });

  it("gives low confidence to few, spread out comps", async () => {
    const r = await compsV1.estimate(input([comp({ soldPrice: 700_000 }), comp({ soldPrice: 1_000_000 }), comp({ soldPrice: 1_400_000 })]));
    if ("insufficientData" in r) throw new Error("expected estimate");
    expect(r.confidence).toBe("low");
    expect(r.low).toBeLessThan(r.amount);
    expect(r.high).toBeGreaterThan(r.amount);
  });

  it("confidence thresholds follow the spec", () => {
    const near = Array.from({ length: 8 }, () => ({ ...comp({ distanceM: 1000 }), adjustedPrice: 1, weight: 1, monthsSinceSale: 1 }));
    expect(confidenceFor(near, 1_000_000, 950_000, 1_060_000)).toBe("high");
    expect(confidenceFor(near.slice(0, 5), 1_000_000, 920_000, 1_090_000)).toBe("medium");
    expect(confidenceFor(near.slice(0, 5), 1_000_000, 850_000, 1_150_000)).toBe("low");
  });

  it("widens to 10 km and 18 months only below 5 tight comps", () => {
    const tight = Array.from({ length: 5 }, () => comp({ distanceM: 1000, soldAt: "2026-05-01" }));
    const far = comp({ distanceM: 8000 });
    expect(selectComps([...tight, far], "2026-09-01")).toHaveLength(5);
    expect(selectComps([...tight.slice(0, 3), far], "2026-09-01")).toHaveLength(4);
  });
});

describe("market index", () => {
  it("interpolates gaps, smooths and clamps", () => {
    const idx = buildIndex({ "2026-01": 100, "2026-03": 110 }, "2026-01", "2026-04");
    expect(Object.keys(idx)).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
    expect(idx["2026-02"]).toBeCloseTo(105, 0);
    const lookup = indexLookup(idx);
    expect(lookup("2025-06")).toBe(idx["2026-01"]);
    expect(lookup("2027-01")).toBe(idx["2026-04"]);
    expect(addMonths("2026-11", 3)).toBe("2027-02");
  });
});

describe("address parsing", () => {
  it("parses common formats", () => {
    expect(parseAddress("12 Maple Ave, Los Angeles")).toMatchObject({ number: 12, street: "Maple Ave", unit: null, city: "Los Angeles" });
    expect(parseAddress("Unit 1204, 88 Harbour St, Toronto, ON M5V 1A1")).toMatchObject({ number: 88, street: "Harbour St", unit: "1204", city: "Toronto", postal: "M5V 1A1" });
    expect(parseAddress("Unit 1204, 88 Harbor St, San Francisco, CA 94110")).toMatchObject({ number: 88, street: "Harbor St", unit: "1204", city: "San Francisco", postal: "94110" });
    expect(parseAddress("12345 Ventura Blvd San Diego")).toMatchObject({ number: 12345, street: "Ventura Blvd", city: "San Diego", postal: null });
    expect(parseAddress("500 Oak St, Sacramento, California 95814-1234")).toMatchObject({ number: 500, street: "Oak St", city: "Sacramento", postal: "95814-1234" });
    expect(parseAddress("88 Harbor St #1204 Los Angeles")).toMatchObject({ number: 88, unit: "1204", city: "Los Angeles" });
    expect(parseAddress("Maple Ave")).toBeNull();
  });
});
