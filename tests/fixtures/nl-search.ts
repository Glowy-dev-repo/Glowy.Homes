import type { SearchParamsInput } from "@/types/search";

// docs/05 Phase 6 criterion 2: at least 9 of these 10 must parse to exactly these SearchParams.
// Fields left at their defaults (type sale, status active, sort newest) are omitted.

export const NL_FIXTURES: { text: string; expected: SearchParamsInput }[] = [
  { text: "3 bed condo under 900k in Simi Valley with parking", expected: { bedsMin: 3, propertyTypes: ["condo"], priceMax: 900_000, city: "simi-valley", parking: true } },
  { text: "2 bedroom apartment for rent in Thousand Oaks under $2,500, pet friendly", expected: { type: "rent", bedsMin: 2, propertyTypes: ["condo"], priceMax: 2_500, city: "thousand-oaks", pets: true } },
  { text: "detached house in Newbury Park between 700k and 1.1m with 2 baths", expected: { propertyTypes: ["detached"], city: "newbury-park", priceMin: 700_000, priceMax: 1_100_000, bathsMin: 2 } },
  { text: "townhouse in Moorpark over 600k", expected: { propertyTypes: ["townhouse"], city: "moorpark", priceMin: 600_000 } },
  { text: "furnished studio for rent in Thousand Oaks", expected: { type: "rent", bedsMin: 0, furnished: true, city: "thousand-oaks" } },
  { text: "4+ beds and 3 baths in Westlake Village with a pool", expected: { bedsMin: 4, bathsMin: 3, city: "westlake-village", keywords: "pool" } },
  { text: "cheapest condos in Thousand Oaks with a balcony", expected: { propertyTypes: ["condo"], city: "thousand-oaks", sort: "price_asc", keywords: "balcony" } },
  { text: "semi detached in Thousand Oaks built after 2000 under 1.5 million", expected: { propertyTypes: ["semi"], city: "thousand-oaks", yearBuiltMin: 2000, priceMax: 1_500_000 } },
  { text: "rentals in Simi Valley with in suite laundry and parking under 3k", expected: { type: "rent", city: "simi-valley", laundry: true, parking: true, priceMax: 3_000 } },
  { text: "homes over 2000 sq ft in Newbury Park listed this week", expected: { sqftMin: 2000, city: "newbury-park", daysOnMarketMax: 7 } },
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
