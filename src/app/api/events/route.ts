import { NextResponse } from "next/server";
import { ANON_COOKIE, EventBatch } from "@/lib/analytics/events";
import { anonId, insertEvents, newAnonId } from "@/lib/analytics/server";
import { invalid } from "@/server/api/respond";
import { rateLimit, rateLimitWrite } from "@/server/api/rate-limit";

/**
 * docs/03 section 8: batched analytics events. Sets the anonymous visitor id cookie on first use.
 * It never reads the session: auth() can refresh the session cookie, and a beacon sent while
 * signing out would sign the user back in. Server side events (login, lead_submit) carry both
 * ids, which links a visitor to an account.
 */
export async function POST(req: Request) {
  const writeLimited = rateLimitWrite(req);
  if (writeLimited) return writeLimited;
  const limited = rateLimit(req);
  if (limited) return limited;
  const parsed = EventBatch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  const existing = await anonId();
  const anon = existing ?? newAnonId();
  await insertEvents(null, anon, parsed.data.events);
  const res = new NextResponse(null, { status: 204 });
  if (!existing) res.cookies.set(ANON_COOKIE, anon, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 395, path: "/" });
  return res;
}
