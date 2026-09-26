import type { SearchParamsInput } from "@/types/search";

// docs/05 Phase 6 criterion 2: at least 9 of these 10 must parse to exactly these SearchParams.
// Fields left at their defaults (type sale, status active, sort newest) are omitted.

export const NL_FIXTURES: { text: string; expected: SearchParamsInput }[] = [
  { text: "3 bed condo under 900k in San Diego with parking", expected: { bedsMin: 3, propertyTypes: ["condo"], priceMax: 900_000, city: "san-diego", parking: true } },
  { text: "2 bedroom apartment for rent in Los Angeles under $2,500, pet friendly", expected: { type: "rent", bedsMin: 2, propertyTypes: ["condo"], priceMax: 2_500, city: "los-angeles", pets: true } },
  { text: "detached house in San Jose between 700k and 1.1m with 2 baths", expected: { propertyTypes: ["detached"], city: "san-jose", priceMin: 700_000, priceMax: 1_100_000, bathsMin: 2 } },
  { text: "townhouse in Sacramento over 600k", expected: { propertyTypes: ["townhouse"], city: "sacramento", priceMin: 600_000 } },
  { text: "furnished studio for rent in Los Angeles", expected: { type: "rent", bedsMin: 0, furnished: true, city: "los-angeles" } },
  { text: "4+ beds and 3 baths in San Francisco with a pool", expected: { bedsMin: 4, bathsMin: 3, city: "san-francisco", keywords: "pool" } },
  { text: "cheapest condos in Los Angeles with a balcony", expected: { propertyTypes: ["condo"], city: "los-angeles", sort: "price_asc", keywords: "balcony" } },
  { text: "semi detached in Los Angeles built after 2000 under 1.5 million", expected: { propertyTypes: ["semi"], city: "los-angeles", yearBuiltMin: 2000, priceMax: 1_500_000 } },
  { text: "rentals in San Diego with in suite laundry and parking under 3k", expected: { type: "rent", city: "san-diego", laundry: true, parking: true, priceMax: 3_000 } },
  { text: "homes over 2000 sq ft in San Jose listed this week", expected: { sqftMin: 2000, city: "san-jose", daysOnMarketMax: 7 } },
];

const DEFAULTS: Record<string, unknown> = { type: "sale", sort: "newest" };

/** Drops default valued fields and sorts arrays, so equal searches compare equal. */
export function normalizeParams(p: SearchParamsInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || DEFAULTS[k] === v) continue;
    if (k === "status" && Array.isArray(v) && v.length === 1 && v[0] === "active") continue;
    out[k] = Array.isArray(v) ? [...v].sort() : v;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}
