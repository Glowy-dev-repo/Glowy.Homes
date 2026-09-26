import { brand } from "@/config/brand";
import { market } from "@/config/market";

const SQFT_PER_M2 = 10.7639;
// Widened so both unit systems stay type checked whichever one the brand config picks.
const units = brand.units as "metric" | "imperial";

const currency = new Intl.NumberFormat(market.locale, { style: "currency", currency: brand.currency, maximumFractionDigits: 0 });
const compactCurrency = new Intl.NumberFormat(market.locale, {
  style: "currency",
  currency: brand.currency,
  notation: "compact",
  maximumFractionDigits: 1,
});
const number = new Intl.NumberFormat(market.locale);

export function formatPrice(amount: number, opts: { listingType?: "sale" | "rent"; compact?: boolean } = {}): string {
  const base = opts.compact ? compactCurrency.format(amount) : currency.format(amount);
  return opts.listingType === "rent" ? `${base}/mo` : base;
}

export function formatNumber(n: number): string {
  return number.format(n);
}

/** Area from stored sqft, shown in the configured unit system. */
export function formatArea(sqft: number | null | undefined): string | null {
  if (!sqft) return null;
  if (units === "metric") return `${number.format(Math.round(sqft / SQFT_PER_M2))} m²`;
  return `${number.format(sqft)} sq ft`;
}

export const areaUnitLabel = units === "metric" ? "m²" : "sq ft";

/** Converts a value typed in the display unit to stored sqft. */
export function toSqft(displayValue: number): number {
  return units === "metric" ? Math.round(displayValue * SQFT_PER_M2) : Math.round(displayValue);
}

export function fromSqft(sqft: number): number {
  return units === "metric" ? Math.round(sqft / SQFT_PER_M2) : sqft;
}

export function formatBeds(beds: number | null | undefined): string | null {
  if (beds === null || beds === undefined) return null;
  return beds === 0 ? "Studio" : `${beds} bd`;
}

export function formatBaths(baths: number | null | undefined): string | null {
  if (baths === null || baths === undefined) return null;
  return `${baths} ba`;
}

export function daysBetween(fromIso: string, to: Date = new Date()): number {
  const from = Date.parse(`${fromIso.slice(0, 10)}T00:00:00Z`);
  const today = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.max(0, Math.round((today - from) / 86_400_000));
}

export function listedAgo(listDate: string, now: Date = new Date()): string {
  const days = daysBetween(listDate, now);
  if (days === 0) return "Listed today";
  if (days === 1) return "Listed 1 day ago";
  if (days < 60) return `Listed ${days} days ago`;
  return `Listed ${Math.round(days / 30)} months ago`;
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  detached: "Detached",
  semi: "Semi detached",
  townhouse: "Townhouse",
  condo: "Condo",
  multi: "Multi unit",
  land: "Land",
  other: "Other",
};

export function propertyTypeLabel(type: string): string {
  return PROPERTY_TYPE_LABELS[type] ?? type;
}

export function formatDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString(market.locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
