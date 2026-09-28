import type { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";

export const { POST } = handlers;

/**
 * Reading the session never writes the session cookie. Auth.js re-issues it on every read, so a read
 * that was in flight when the user signed out could land after the sign out and sign them back in.
 * Sessions therefore last a fixed 30 days from sign in. Updates (POST) still write the cookie.
 */
export async function GET(req: NextRequest) {
  const res = await handlers.GET(req);
  if (!req.nextUrl.pathname.endsWith("/session")) return res;
  const kept = res.headers.getSetCookie().filter((c) => !/^(__Secure-)?authjs\.session-token/.test(c));
  if (kept.length === res.headers.getSetCookie().length) return res;
  const headers = new Headers(res.headers);
  headers.delete("set-cookie");
  for (const c of kept) headers.append("set-cookie", c);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
