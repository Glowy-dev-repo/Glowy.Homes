import { z } from "zod";
import { searchProvider } from "@/lib/search/provider";
import { invalid, ok } from "@/server/api/respond";
import { rateLimit } from "@/server/api/rate-limit";

const Query = z.object({ q: z.string().trim().max(100).default(""), type: z.enum(["sale", "rent"]).default("sale") });

export async function GET(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;

  const url = new URL(req.url);
  const parsed = Query.safeParse({ q: url.searchParams.get("q") ?? undefined, type: url.searchParams.get("type") ?? undefined });
  if (!parsed.success) return invalid(parsed.error);

  const items = await searchProvider().autocomplete(parsed.data.q, parsed.data.type);
  return ok(items, {}, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } });
}
