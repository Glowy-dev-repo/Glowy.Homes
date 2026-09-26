import type { SearchParams, SearchResult } from "@/types/search";
import { autocomplete, type Suggestion } from "./autocomplete";
import { createTtlCache } from "./cache";
import { searchListings } from "./postgres";
import { toQueryString } from "./url";

/**
 * Search provider boundary (docs/03 section 4). Postgres today; a Typesense implementation can
 * slot in behind the same interface when measurements call for it.
 */
export interface SearchProvider {
  search(params: SearchParams): Promise<SearchResult>;
  autocomplete(q: string, type?: "sale" | "rent"): Promise<Suggestion[]>;
}

export const postgresProvider: SearchProvider = { search: searchListings, autocomplete };

export function searchProvider(): SearchProvider {
  return postgresProvider;
}

// One 60 second cache (docs/02 section 7) shared by the /search page and /api/search, so the page
// and the client refetch after hydration hit the same entry.
const cache = createTtlCache<SearchResult>(60_000);

export async function cachedSearch(params: SearchParams): Promise<{ data: SearchResult; hit: boolean }> {
  const key = toQueryString(params);
  const hit = cache.get(key);
  if (hit) return { data: hit, hit: true };
  const data = await searchProvider().search(params);
  cache.set(key, data);
  return { data, hit: false };
}
