import type { PropertyType } from "@/db/schema/listings";

export const SALE_PRICES = [200_000, 300_000, 400_000, 500_000, 600_000, 700_000, 800_000, 900_000, 1_000_000, 1_250_000, 1_500_000, 1_750_000, 2_000_000, 2_500_000, 3_000_000, 4_000_000, 5_000_000];
export const RENT_PRICES = [1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000, 3500, 4000, 5000, 6000, 8000];
export const BED_OPTIONS = [0, 1, 2, 3, 4, 5];
export const BATH_OPTIONS = [0, 1, 1.5, 2, 3, 4];
export const HOME_TYPES: { value: PropertyType; label: string }[] = [
  { value: "detached", label: "Detached" },
  { value: "semi", label: "Semi detached" },
  { value: "townhouse", label: "Townhouse" },
  { value: "condo", label: "Condo" },
  { value: "multi", label: "Multi unit" },
  { value: "land", label: "Land" },
];
export const DAYS_ON_MARKET = [1, 7, 14, 30, 90];
export const SORT_LABELS = {
  newest: "Newest",
  price_asc: "Price, low to high",
  price_desc: "Price, high to low",
  sqft_desc: "Largest",
  ppsf_asc: "Price per area, low to high",
} as const;
