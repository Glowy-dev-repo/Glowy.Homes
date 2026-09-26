import { trackServer } from "@/lib/analytics/server";
import { auth } from "@/lib/auth";
import { isUuid } from "@/lib/listings/detail";
import { fail, ok, unauthorized } from "@/server/api/respond";
import { claimState, startClaim } from "@/server/data/owner";
import { rateLimitWrite } from "@/server/api/rate-limit";

type Ctx = { params: Promise<{ id: string }> };
const notFound = () => fail(404, { code: "not_found", message: "Property not found." });

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const session = await auth();
  return ok(await claimState(session?.user?.id ?? null, id));
}

export async function POST(req: Request, { params }: Ctx) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return unauthorized();
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const result = await startClaim(session.user.id, session.user.email, id);
  if (result.status === "not_found") return notFound();
  if (result.status === "taken") return fail(409, { code: "already_claimed", message: "Someone has already claimed this home. Contact support if this is your home." });
  if (result.status === "claimed") await trackServer("claim_home", { propertyId: id }, session.user.id);
  return ok(result);
}
