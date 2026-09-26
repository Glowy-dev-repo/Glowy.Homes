import { z } from "zod";
import { LEAD_STATUSES, LEAD_TYPES } from "@/db/schema/leads";
import { invalid, ok } from "@/server/api/respond";
import { requirePro } from "@/server/api/pro";
import { inbox, inboxStats } from "@/server/data/pro-leads";

const Query = z.object({ status: z.enum(LEAD_STATUSES).optional(), type: z.enum(LEAD_TYPES).optional() });

/** docs/02 GET /api/pro/leads: the signed in pro's inbox only. */
export async function GET(req: Request) {
  const who = await requirePro();
  if ("response" in who) return who.response;
  const url = new URL(req.url);
  const parsed = Query.safeParse({ status: url.searchParams.get("status") ?? undefined, type: url.searchParams.get("type") ?? undefined });
  if (!parsed.success) return invalid(parsed.error);
  const [items, stats] = await Promise.all([inbox(who.pro.proId, parsed.data), inboxStats(who.pro.proId, who.pro.capPerDay)]);
  return ok({ items, stats });
}
