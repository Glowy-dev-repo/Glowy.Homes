import type { SearchParams, SearchResult } from "@/types/search";
import { autocomplete, type Suggestion } from "./autocomplete";
import { searchListings } from "./postgres";

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
