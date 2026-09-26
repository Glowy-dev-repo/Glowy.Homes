import { describe, expect, it } from "vitest";
import { acceptableSummary, templateSummary, type SummaryFacts } from "@/lib/regions/summary";

const facts: SummaryFacts = {
  name: "Lake Commons",
  cityName: "Los Angeles",
  saleCount: 436,
  rentCount: 255,
  medianPrice: 1_252_500,
  cityMedianPrice: 1_060_000,
  medianRent: 3450,
  medianDom: 18,
  medianYearBuilt: 1998,
  typeMix: [{ type: "condo", share: 0.62 }, { type: "townhouse", share: 0.21 }, { type: "detached", share: 0.1 }],
};

describe("neighborhood summaries (docs/05 Phase 6 task 3)", () => {
  it("states the market from the facts, with the city comparison", () => {
    const s = templateSummary(facts);
    expect(s).toContain("The median asking price in Lake Commons is $1,252,500, about 18% above the Los Angeles median.");
    expect(s).toContain("condos (62%) and townhouses (21%)");
    expect(s).toContain("built around 1998");
    expect(s).toContain("436 homes for sale and 255 rentals");
    expect(s).not.toMatch(/[–—]|\s-\s/);
    expect(acceptableSummary(s)).toBe(true);
  });

  it("handles a neighborhood with no listings", () => {
    expect(templateSummary({ ...facts, saleCount: 0, rentCount: 0, medianPrice: null, medianRent: null, medianDom: null, typeMix: [] })).toBe("Lake Commons has no active listings right now.");
  });

  it("rejects LLM text about people, schools or safety, or with dashes", () => {
    const base = "Homes in Lake Commons are mostly condos with a median asking price of $1,252,500, above the city median.";
    expect(acceptableSummary(base)).toBe(true);
    expect(acceptableSummary(`${base} It is great for young families.`)).toBe(false);
    expect(acceptableSummary(`${base} Close to good schools.`)).toBe(false);
    expect(acceptableSummary(`${base} A safe, quiet area.`)).toBe(false);
    expect(acceptableSummary(`${base} Prices rose — fast.`)).toBe(false);
  });
});
