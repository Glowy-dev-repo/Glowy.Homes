import { z } from "zod";
import { isUuid } from "@/lib/listings/detail";
import { fail, invalid, ok, unauthorized } from "@/server/api/respond";
import { currentUserId } from "@/server/api/session";
import { submitApplication } from "@/server/data/rentals";

/** docs/02 POST /api/rentals/applications/[id]/submit: send the saved application to a listing. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  if (!isUuid(id)) return fail(404, { code: "not_found", message: "Application not found." });
  const parsed = z.object({ listingId: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  const r = await submitApplication(userId, id, parsed.data.listingId);
  switch (r.status) {
    case "submitted":
      return ok(r, {}, { status: 201 });
    case "already":
      return fail(409, { code: "already_applied", message: "You already applied to this rental." });
    case "not_rental":
      return fail(409, { code: "not_available", message: "This rental is not taking applications." });
    case "own_listing":
      return fail(409, { code: "own_listing", message: "You cannot apply to your own listing." });
    default:
      return fail(404, { code: "not_found", message: "Application or listing not found." });
  }
}
