import { z } from "zod";
import { invalid, ok, unauthorized } from "@/server/api/respond";
import { currentUserId } from "@/server/api/session";
import { recentlyViewed, recordRecentlyViewed } from "@/server/data/saved";
import { rateLimitWrite } from "@/server/api/rate-limit";

const Body = z.object({
  items: z.array(z.object({ listingId: z.string().uuid(), viewedAt: z.string().datetime({ offset: true }) })).max(50),
});

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  return ok(await recentlyViewed(userId));
}

export async function POST(req: Request) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  await recordRecentlyViewed(userId, parsed.data.items);
  return ok({ recorded: parsed.data.items.length });
}
