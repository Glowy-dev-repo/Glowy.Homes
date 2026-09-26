import type { SearchParams } from "@/types/search";

export function searchTitle(p: SearchParams, placeName: string | null): string {
  const what = p.type === "rent" ? "Rentals" : p.status.includes("sold") && p.status.length === 1 ? "Recently sold homes" : "Homes for sale";
  if (placeName) return `${what} in ${placeName}`;
  if (p.bounds || p.polygon) return `${what} in this area`;
  if (p.q) return `${what} matching "${p.q}"`;
  return what;
}
