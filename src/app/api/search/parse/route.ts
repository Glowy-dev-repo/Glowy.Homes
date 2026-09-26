import { z } from "zod";
import { brand } from "@/config/brand";
import { describeParams } from "@/lib/nl-search/chips";
import { parseNaturalQuery } from "@/lib/nl-search";
import { allRegions } from "@/lib/search/regions";
import { toQueryString } from "@/lib/search/url";
import { invalid, ok } from "@/server/api/respond";
import { rateLimit, rateLimitWrite } from "@/server/api/rate-limit";

const Body = z.object({ text: z.string().trim().min(3, "Describe the home you want.").max(300, "Keep it under 300 characters.") });

/** docs/05 Phase 6 task 2: natural language to SearchParams, with chips the user can remove. */
export async function POST(req: Request) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const limited = rateLimit(req);
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);

  const regions = await allRegions();
  const neighborhoods = regions
    .filter((r) => r.type === "neighborhood" && r.parentSlug)
    .map((r) => ({ name: r.name, slug: r.slug, citySlug: r.parentSlug! }));
  const { params, provider } = await parseNaturalQuery(parsed.data.text, { cities: brand.market.cities, neighborhoods });
  return ok({ params, chips: describeParams(params).map(({ id, label }) => ({ id, label })), query: toQueryString(params), provider });
}
