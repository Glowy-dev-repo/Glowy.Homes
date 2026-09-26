import { z } from "zod";
import { fail, invalid, ok, unauthorized } from "@/server/api/respond";
import { currentUserId } from "@/server/api/session";
import { saveHome, savedHomeIds, savedHomes, unsaveHome } from "@/server/data/saved";
import { rateLimitWrite } from "@/server/api/rate-limit";

const Body = z.object({ listingId: z.string().uuid() });

export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const idsOnly = new URL(req.url).searchParams.get("ids") === "1";
  return ok(idsOnly ? await savedHomeIds(userId) : await savedHomes(userId));
}

async function parse(req: Request) {
  return Body.safeParse(await req.json().catch(() => null));
}

export async function POST(req: Request) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const parsed = await parse(req);
  if (!parsed.success) return invalid(parsed.error);
  const inserted = await saveHome(userId, parsed.data.listingId);
  return ok({ saved: true, changed: inserted });
}

export async function DELETE(req: Request) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const parsed = await parse(req);
  if (!parsed.success) return invalid(parsed.error);
  const removed = await unsaveHome(userId, parsed.data.listingId);
  if (!removed) return fail(404, { code: "not_found", message: "That home is not in your saved list." });
  return ok({ saved: false, changed: true });
}
