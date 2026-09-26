import { describe, expect, it } from "vitest";
import { activeFilterCount, parseSearchParams, parseSearchParamsStrict, toQueryString } from "@/lib/search/url";
import { SearchParams } from "@/types/search";

describe("search URL codec", () => {
  it("round trips every filter", () => {
    const input = SearchParams.parse({
      type: "rent",
      status: ["active", "pending"],
      q: "maple",
      city: "toronto",
      neighborhood: "cedar-park",
      bounds: [-79.5, 43.6, -79.3, 43.7],
      polygon: [[-79.5, 43.6], [-79.4, 43.7], [-79.3, 43.6]],
      priceMin: 1500,
      priceMax: 3000,
      bedsMin: 2,
      bathsMin: 1.5,
      propertyTypes: ["condo", "townhouse"],
      sqftMin: 500,
      sqftMax: 1200,
      yearBuiltMin: 2000,
      daysOnMarketMax: 14,
      keywords: "balcony",
      pets: true,
      furnished: false,
      availableBy: "2026-11-01",
      sort: "price_asc",
      page: 3,
    });
    const qs = toQueryString(input);
    expect(parseSearchParams(new URLSearchParams(qs))).toEqual(input);
  });

  it("omits defaults so equal searches give equal URLs", () => {
    expect(toQueryString({})).toBe("");
    expect(toQueryString({ type: "sale", status: ["active"], sort: "newest", page: 1, city: "toronto" })).toBe("city=toronto");
  });

  it("lenient parse drops only the invalid fields", () => {
    const p = parseSearchParams(new URLSearchParams("city=toronto&bedsMin=99&propertyTypes=castle&priceMax=500000"));
    expect(p.city).toBe("toronto");
    expect(p.priceMax).toBe(500000);
    expect(p.bedsMin).toBeUndefined();
    expect(p.propertyTypes).toBeUndefined();
  });

  it("strict parse rejects invalid input for the API", () => {
    expect(parseSearchParamsStrict(new URLSearchParams("bounds=1,2,3")).success).toBe(false);
    expect(parseSearchParamsStrict(new URLSearchParams("type=lease")).success).toBe(false);
    expect(parseSearchParamsStrict(new URLSearchParams("type=rent&pets=true")).success).toBe(true);
  });

  it("counts active filters for the mobile badge", () => {
    expect(activeFilterCount(SearchParams.parse({ city: "toronto", sort: "price_asc" }))).toBe(0);
    expect(activeFilterCount(SearchParams.parse({ priceMax: 1, bedsMin: 2, propertyTypes: ["condo"], status: ["sold"] }))).toBe(4);
  });
});
