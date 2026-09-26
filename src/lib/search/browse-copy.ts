import { formatNumber, formatPrice } from "@/lib/format";
import type { RegionStats } from "@/db/schema/geo";

/** One paragraph of stats for a browse page (docs/04 City browse page). Plain sentences, no dashes. */
export function browseSummary(place: string, type: "sale" | "rent", stats: RegionStats): string {
  const count = type === "rent" ? Number(stats.rent_count ?? 0) : Number(stats.listing_count ?? 0);
  if (!count) return `There are no ${type === "rent" ? "rentals" : "homes for sale"} in ${place} right now. Save a search to hear when one is listed.`;
  const noun = type === "rent" ? (count === 1 ? "rental" : "rentals") : count === 1 ? "home for sale" : "homes for sale";
  const parts = [`There ${count === 1 ? "is" : "are"} ${formatNumber(count)} ${noun} in ${place}.`];
  if (type === "rent" && stats.median_rent) {
    parts.push(`The median asking rent is ${formatPrice(Number(stats.median_rent), { listingType: "rent" })}.`);
  }
  if (type === "sale" && stats.median_price) {
    parts.push(`The median list price is ${formatPrice(Number(stats.median_price))}.`);
  }
  if (type === "sale" && stats.median_dom !== undefined && stats.median_dom !== null) {
    const dom = Number(stats.median_dom);
    parts.push(`Homes here have typically been listed for ${dom} ${dom === 1 ? "day" : "days"}.`);
  }
  return parts.join(" ");
}

export type QuickLink = { label: string; query: Record<string, string> };

export function quickLinks(place: string, type: "sale" | "rent"): QuickLink[] {
  if (type === "rent") {
    return [
      { label: `Condos for rent in ${place}`, query: { propertyTypes: "condo" } },
      { label: `Pet friendly rentals in ${place}`, query: { pets: "true" } },
      { label: `Rentals under $2,500 in ${place}`, query: { priceMax: "2500" } },
      { label: `Furnished rentals in ${place}`, query: { furnished: "true" } },
    ];
  }
  return [
    { label: `Condos for sale in ${place}`, query: { propertyTypes: "condo" } },
    { label: `Detached homes in ${place}`, query: { propertyTypes: "detached" } },
    { label: `Townhouses in ${place}`, query: { propertyTypes: "townhouse" } },
    { label: `Homes under $800K in ${place}`, query: { priceMax: "800000" } },
    { label: `Homes $800K to $1.5M in ${place}`, query: { priceMin: "800000", priceMax: "1500000" } },
    { label: `Homes over $1.5M in ${place}`, query: { priceMin: "1500000" } },
    { label: `Recently sold in ${place}`, query: { status: "sold" } },
  ];
}
