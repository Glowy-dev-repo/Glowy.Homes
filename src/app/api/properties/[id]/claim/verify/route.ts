import { z } from "zod";
import { trackServer } from "@/lib/analytics/server";
import { auth } from "@/lib/auth";
import { isUuid } from "@/lib/listings/detail";
import { fail, invalid, ok, unauthorized } from "@/server/api/respond";
import { verifyClaim } from "@/server/data/owner";
import { rateLimitWrite } from "@/server/api/rate-limit";

const Body = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6 digit code.") });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const { id } = await params;
  if (!isUuid(id)) return fail(404, { code: "not_found", message: "Property not found." });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);

  const result = await verifyClaim(session.user.id, id, parsed.data.code);
  switch (result.status) {
    case "claimed":
      await trackServer("claim_home", { propertyId: id }, session.user.id);
      return ok(result);
    case "wrong_code":
      return fail(400, { code: "wrong_code", message: `That code does not match. ${result.attemptsLeft} attempts left.`, fields: { code: ["That code does not match."] } });
    case "locked":
      return fail(429, { code: "locked", message: "Too many attempts. Start the claim again to get a new code." });
    case "taken":
      return fail(409, { code: "already_claimed", message: "Someone has already claimed this home." });
    default:
      return fail(404, { code: "no_claim", message: "No claim in progress. Start the claim again." });
  }
}
