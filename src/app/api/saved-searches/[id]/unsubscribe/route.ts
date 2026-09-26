import { sqlClient } from "@/db";
import { verifyUnsubscribeToken } from "@/lib/alerts/token";
import { isUuid } from "@/lib/listings/detail";
import { fail, ok } from "@/server/api/respond";
import { rateLimit, rateLimitWrite } from "@/server/api/rate-limit";

/**
 * One click unsubscribe from one saved search (RFC 8058 List-Unsubscribe-Post, docs/03 section 6).
 * The signed token stands in for a session, so it works from any mail client.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const limited = rateLimit(req);
  if (limited) return limited;
  const { id } = await params;
  const token = new URL(req.url).searchParams.get("token");
  if (!isUuid(id) || !verifyUnsubscribeToken(id, token)) return fail(404, { code: "not_found", message: "This unsubscribe link is not valid." });
  await sqlClient`update saved_searches set alert_frequency = 'off' where id = ${id}`;
  return ok({ unsubscribed: true });
}
