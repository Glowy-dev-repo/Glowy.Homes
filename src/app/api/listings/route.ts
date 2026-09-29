import { UserListingInput } from "@/lib/listings/user-listing-schema";
import { fail, invalid, ok, unauthorized } from "@/server/api/respond";
import { currentUserId } from "@/server/api/session";
import { createUserListing } from "@/server/data/user-listings";
import { rateLimitWrite } from "@/server/api/rate-limit";

/** docs/02 POST /api/listings: FSBO or rental listing, enters in_review with auto checks. */
export async function POST(req: Request) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const parsed = UserListingInput.safeParse(await req.json().catch(() => null));
  // Server side twin of the wizard's checks: fewer than 3 photos never gets through (Phase 5 criterion 2).
  if (!parsed.success) return invalid(parsed.error);
  const result = await createUserListing(userId, parsed.data);
  if (result.status === "not_found") return fail(404, { code: "not_found", message: "We could not find that address. Look it up again." });
  if (result.status === "bad_photos") return fail(400, { code: "bad_photos", message: "Add your photos again, then submit." });
  if (result.status === "claimed_by_other") return fail(403, { code: "claimed", message: "This home has been claimed by someone else." });
  return ok(result, {}, { status: 201 });
}
