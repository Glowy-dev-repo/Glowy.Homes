import { createTtlCache } from "@/lib/search/cache";
import { searchProvider } from "@/lib/search/provider";
import { parseSearchParamsStrict, toQueryString } from "@/lib/search/url";
import { invalid, ok } from "@/server/api/respond";
import { rateLimit } from "@/server/api/rate-limit";
import type { SearchResult } from "@/types/search";

const cache = createTtlCache<SearchResult>(60_000);

export async function GET(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;

  const parsed = parseSearchParamsStrict(new URL(req.url).searchParams);
  if (!parsed.success) return invalid(parsed.error);

  const key = toQueryString(parsed.data);
  const started = performance.now();
  let data = cache.get(key);
  const hit = !!data;
  if (!data) {
    data = await searchProvider().search(parsed.data);
    cache.set(key, data);
  }
  return ok(
    data,
    { query: key, cached: hit, ms: Math.round(performance.now() - started) },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=60" } },
  );
}
