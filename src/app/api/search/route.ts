import { cachedSearch } from "@/lib/search/provider";
import { parseSearchParamsStrict, toQueryString } from "@/lib/search/url";
import { invalid, ok } from "@/server/api/respond";
import { rateLimit } from "@/server/api/rate-limit";

export async function GET(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;

  const parsed = parseSearchParamsStrict(new URL(req.url).searchParams);
  if (!parsed.success) return invalid(parsed.error);

  const key = toQueryString(parsed.data);
  const started = performance.now();
  const { data, hit } = await cachedSearch(parsed.data);
  return ok(
    data,
    { query: key, cached: hit, ms: Math.round(performance.now() - started) },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=60" } },
  );
}
