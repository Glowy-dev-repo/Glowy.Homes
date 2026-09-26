import { describe, expect, it } from "vitest";
import { brand } from "@/config/brand";
import { describeParams, removeChip } from "@/lib/nl-search/chips";
import { sanitize } from "@/lib/nl-search";
import { parseQueryRules } from "@/lib/nl-search/rules";
import { NL_FIXTURES, normalizeParams } from "../fixtures/nl-search";

const ctx = { cities: brand.market.cities, now: new Date("2026-09-26T12:00:00Z") };

describe("natural language search, rules provider (docs/05 Phase 6 criterion 2)", () => {
  for (const f of NL_FIXTURES) {
    it(f.text, () => {
      expect(normalizeParams(sanitize(parseQueryRules(f.text, ctx)))).toEqual(normalizeParams(f.expected));
    });
  }

  it("does not read bedroom counts or areas as prices", () => {
    const p = parseQueryRules("at least 3 beds over 1500 sq ft in Los Angeles", ctx);
    expect(p.priceMin).toBeUndefined();
    expect(p).toMatchObject({ bedsMin: 3, sqftMin: 1500, city: "los-angeles" });
  });

  it("understands metric areas and neighborhoods", () => {
    const p = parseQueryRules("condo over 90 m2 in Liberty Village", { ...ctx, neighborhoods: [{ name: "Liberty Village", slug: "liberty-village", citySlug: "los-angeles" }] });
    expect(p).toMatchObject({ sqftMin: 969, city: "los-angeles", neighborhood: "liberty-village", propertyTypes: ["condo"] });
  });

  it("ignores rental only amenities for homes for sale", () => {
    expect(parseQueryRules("furnished house in San Jose", ctx).furnished).toBeUndefined();
  });

  it("sanitize drops fields the schema rejects", () => {
    expect(sanitize({ bedsMin: 99, city: "los-angeles", page: 3 } as never)).toEqual({ city: "los-angeles" });
  });
});

describe("parsed filter chips", () => {
  it("describes and removes filters", () => {
    const params = { type: "rent" as const, city: "los-angeles", priceMax: 2500, bedsMin: 2, pets: true };
    const chips = describeParams(params);
    expect(chips.map((c) => c.label)).toEqual(["For rent", "Los Angeles", "Under $2,500/mo", "2+ beds", "Pets allowed"]);
    expect(removeChip(params, chips.find((c) => c.id === "price")!)).toEqual({ type: "rent", city: "los-angeles", bedsMin: 2, pets: true });
  });
});
