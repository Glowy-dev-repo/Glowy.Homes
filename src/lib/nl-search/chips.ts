import { brand } from "@/config/brand";
import { formatArea, formatPrice } from "@/lib/format";
import type { SearchParamsInput } from "@/types/search";

// Parsed filters shown as removable chips (docs/05 Phase 6 task 2). Client safe.

export type Chip = { id: string; label: string; remove: (keyof SearchParamsInput)[] };

const TYPE_LABEL: Record<string, string> = { detached: "Detached", semi: "Semi detached", townhouse: "Townhouse", condo: "Condo", multi: "Multi unit", land: "Land", other: "Other" };
const SORT_LABEL: Record<string, string> = { price_asc: "Lowest price first", price_desc: "Highest price first", sqft_desc: "Largest first", ppsf_asc: "Best price per area" };

const titleCase = (slug: string) => slug.split("-").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");

export function describeParams(p: SearchParamsInput): Chip[] {
  const rent = p.type === "rent";
  const money = (n: number) => formatPrice(n, { listingType: rent ? "rent" : "sale" });
  const chips: Chip[] = [{ id: "type", label: rent ? "For rent" : "For sale", remove: ["type"] }];
  if (p.status?.length && !(p.status.length === 1 && p.status[0] === "active")) chips.push({ id: "status", label: p.status.map(titleCase).join(", "), remove: ["status"] });
  if (p.city) chips.push({ id: "city", label: brand.market.cities.find((c) => c.slug === p.city)?.name ?? titleCase(p.city), remove: ["city", "neighborhood"] });
  if (p.neighborhood) chips.push({ id: "neighborhood", label: titleCase(p.neighborhood), remove: ["neighborhood"] });
  if (p.priceMin !== undefined && p.priceMax !== undefined) chips.push({ id: "price", label: `${money(p.priceMin)} to ${money(p.priceMax)}`, remove: ["priceMin", "priceMax"] });
  else if (p.priceMax !== undefined) chips.push({ id: "price", label: `Under ${money(p.priceMax)}`, remove: ["priceMax"] });
  else if (p.priceMin !== undefined) chips.push({ id: "price", label: `Over ${money(p.priceMin)}`, remove: ["priceMin"] });
  if (p.bedsMin !== undefined) chips.push({ id: "beds", label: p.bedsMin === 0 ? "Studio or more" : `${p.bedsMin}+ beds`, remove: ["bedsMin"] });
  if (p.bathsMin !== undefined) chips.push({ id: "baths", label: `${p.bathsMin}+ baths`, remove: ["bathsMin"] });
  if (p.propertyTypes?.length) chips.push({ id: "types", label: p.propertyTypes.map((t) => TYPE_LABEL[t] ?? t).join(", "), remove: ["propertyTypes"] });
  if (p.sqftMin !== undefined) chips.push({ id: "sqftMin", label: `Over ${formatArea(p.sqftMin)}`, remove: ["sqftMin"] });
  if (p.sqftMax !== undefined) chips.push({ id: "sqftMax", label: `Under ${formatArea(p.sqftMax)}`, remove: ["sqftMax"] });
  if (p.yearBuiltMin !== undefined) chips.push({ id: "year", label: `Built ${p.yearBuiltMin} or later`, remove: ["yearBuiltMin"] });
  if (p.daysOnMarketMax !== undefined) chips.push({ id: "dom", label: p.daysOnMarketMax === 1 ? "Listed today" : `Listed in the last ${p.daysOnMarketMax} days`, remove: ["daysOnMarketMax"] });
  if (p.parking) chips.push({ id: "parking", label: "Parking", remove: ["parking"] });
  if (p.pets) chips.push({ id: "pets", label: "Pets allowed", remove: ["pets"] });
  if (p.furnished) chips.push({ id: "furnished", label: "Furnished", remove: ["furnished"] });
  if (p.laundry) chips.push({ id: "laundry", label: "In suite laundry", remove: ["laundry"] });
  if (p.keywords) chips.push({ id: "keywords", label: `Mentions ${p.keywords}`, remove: ["keywords"] });
  if (p.sort && SORT_LABEL[p.sort]) chips.push({ id: "sort", label: SORT_LABEL[p.sort], remove: ["sort"] });
  return chips;
}

export function removeChip(p: SearchParamsInput, chip: Chip): SearchParamsInput {
  const next = { ...p };
  for (const k of chip.remove) delete next[k];
  return next;
}
