import { RentalApplicationProfile } from "@/lib/listings/user-listing-schema";
import { invalid, ok, unauthorized } from "@/server/api/respond";
import { currentUserId } from "@/server/api/session";
import { myApplication, saveApplication } from "@/server/data/rentals";
import { rateLimitWrite } from "@/server/api/rate-limit";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  return ok(await myApplication(userId));
}

/** docs/02 POST /api/rentals/applications: create or update the renter's one reusable application. */
export async function POST(req: Request) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const parsed = RentalApplicationProfile.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  return ok({ id: await saveApplication(userId, parsed.data) });
}
