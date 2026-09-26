import { getListingDetail } from "@/lib/listings/detail";
import { fail, ok } from "@/server/api/respond";
import { rateLimit } from "@/server/api/rate-limit";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req);
  if (limited) return limited;
  const listing = await getListingDetail((await params).id);
  if (!listing) return fail(404, { code: "not_found", message: "Listing not found." });
  return ok(listing, {}, { headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=300" } });
}
