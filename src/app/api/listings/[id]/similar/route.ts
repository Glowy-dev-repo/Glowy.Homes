import { isUuid } from "@/lib/listings/detail";
import { similarListings } from "@/lib/listings/similar";
import { fail, ok } from "@/server/api/respond";
import { rateLimit } from "@/server/api/rate-limit";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req);
  if (limited) return limited;
  const { id } = await params;
  if (!isUuid(id)) return fail(404, { code: "not_found", message: "Listing not found." });
  const items = await similarListings(id);
  return ok(items, { strict: items.filter((i) => i.strict).length }, { headers: { "Cache-Control": "public, s-maxage=600" } });
}
