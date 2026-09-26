import { ok } from "@/server/api/respond";
import { requireAdmin } from "@/server/api/pro";
import { leadStats } from "@/server/data/admin";

export async function GET() {
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  return ok(await leadStats());
}
