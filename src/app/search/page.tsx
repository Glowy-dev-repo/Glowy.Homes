import type { Metadata } from "next";
import { SearchApp } from "@/components/search/SearchApp";
import { searchTitle } from "@/lib/search/title";
import { brand } from "@/config/brand";
import { cachedSearch } from "@/lib/search/provider";
import { findCity, findNeighborhood, marketBbox } from "@/lib/search/regions";
import { parseSearchParams, toQueryString } from "@/lib/search/url";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function placeFor(city?: string, neighborhood?: string) {
  if (neighborhood) {
    const hood = await findNeighborhood(city, neighborhood);
    if (hood) return { name: `${hood.name}, ${hood.parentName}`, bbox: hood.bbox };
  }
  if (city) {
    const c = await findCity(city);
    if (c) return { name: c.name, bbox: c.bbox };
  }
  return null;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = parseSearchParams(await searchParams);
  const place = await placeFor(params.city, params.neighborhood);
  const title = searchTitle(params, place?.name ?? null);
  // Canonical keeps only what defines the page (type and place), not transient filters.
  const canonical = `/search?${toQueryString({ type: params.type, city: params.city, neighborhood: params.neighborhood })}`.replace(/\?$/, "");
  return {
    title,
    description: `${title} on ${brand.name}. Filter by price, bedrooms, bathrooms and home type, and see every result on a map.`,
    alternates: { canonical },
    robots: params.bounds || params.polygon || params.page > 1 ? { index: false, follow: true } : undefined,
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const params = parseSearchParams(await searchParams);
  // Without a place, the map opens on every city in the market.
  const [{ data: result }, place, market] = await Promise.all([cachedSearch(params), placeFor(params.city, params.neighborhood), marketBbox()]);

  // No Suspense boundary: the page is dynamic, so useSearchParams does not suspend, and a streamed
  // boundary would briefly duplicate the results in a hidden container.
  return (
    <SearchApp
      initialKey={toQueryString(params)}
      initialResult={result}
      placeName={place?.name ?? null}
      regionBbox={place?.bbox ?? market}
    />
  );
}
