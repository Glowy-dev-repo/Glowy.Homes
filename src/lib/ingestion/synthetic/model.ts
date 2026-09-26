import type { PropertyType } from "@/db/schema/listings";
import type { CityDef } from "./market";

/**
 * The hidden pricing formula for synthetic data. Sold prices are this value plus noise, which
 * makes valuation accuracy measurable against a known truth (docs/05 Phase 3 criterion 2).
 * Nothing in the app may import this outside seeding and accuracy checks.
 */

const MODEL_EPOCH = Date.UTC(2023, 0, 1);
const MONTH_MS = 30.4375 * 24 * 3600 * 1000;

/** Market level for a city at a date: steady growth plus a mild spring peak. */
export function marketIndex(city: Pick<CityDef, "annualGrowth">, date: Date): number {
  const months = (date.getTime() - MODEL_EPOCH) / MONTH_MS;
  const seasonal = 1 + 0.012 * Math.sin((2 * Math.PI * (date.getUTCMonth() - 1)) / 12);
  return Math.pow(1 + city.annualGrowth, months / 12) * seasonal;
}

const TYPE_FACTOR: Record<PropertyType, number> = {
  detached: 1,
  semi: 0.95,
  townhouse: 0.92,
  condo: 1.05,
  multi: 0.85,
  land: 1,
  other: 0.9,
};

export const REF: Record<Exclude<PropertyType, "land">, { sqft: number; beds: number; baths: number }> = {
  detached: { sqft: 2100, beds: 4, baths: 3 },
  semi: { sqft: 1500, beds: 3, baths: 2 },
  townhouse: { sqft: 1450, beds: 3, baths: 2.5 },
  condo: { sqft: 750, beds: 2, baths: 1 },
  multi: { sqft: 2800, beds: 5, baths: 3 },
  other: { sqft: 1400, beds: 3, baths: 2 },
};

export type ModelInput = {
  propertyType: PropertyType;
  sqft?: number;
  beds?: number;
  baths?: number;
  yearBuilt?: number;
  lotSqft?: number;
  neighborhoodFactor: number;
};

export function trueValue(city: CityDef, p: ModelInput, date: Date): number {
  const idx = marketIndex(city, date);
  if (p.propertyType === "land") {
    return Math.round(city.ppsf * 0.2 * (p.lotSqft ?? 6000) * p.neighborhoodFactor * idx);
  }
  const ref = REF[p.propertyType];
  const sqft = p.sqft ?? ref.sqft;
  const size = ref.sqft * Math.pow(sqft / ref.sqft, 0.7);
  const beds = 1 + 0.03 * ((p.beds ?? ref.beds) - ref.beds);
  const baths = 1 + 0.025 * ((p.baths ?? ref.baths) - ref.baths);
  const age = 1 + 0.002 * ((p.yearBuilt ?? 1995) - 1995);
  const lot =
    p.propertyType === "detached" || p.propertyType === "semi" ? Math.pow((p.lotSqft ?? 4000) / 4000, 0.12) : 1;
  return Math.round(city.ppsf * TYPE_FACTOR[p.propertyType] * size * beds * baths * age * lot * p.neighborhoodFactor * idx);
}

/** Monthly rent implied by value and a gross yield (docs/03 default 4.5% a year). */
export function trueRent(value: number, propertyType: PropertyType): number {
  const yieldByType: Partial<Record<PropertyType, number>> = { condo: 0.045, multi: 0.05, townhouse: 0.042 };
  return Math.round((value * (yieldByType[propertyType] ?? 0.04)) / 12 / 5) * 5;
}
