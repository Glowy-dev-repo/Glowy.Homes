import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
import type { Role } from "@/db/schema/users";
import { accessFor } from "@/lib/auth-access";
import { PREVIEW_COOKIE, isPreviewExempt, previewPassword, previewToken, sameString } from "@/lib/preview";

/** Private preview: without the preview cookie, pages go to the password page and API calls get 401. */
async function previewGate(req: NextRequest): Promise<NextResponse | null> {
  const password = previewPassword();
  const { pathname, search } = req.nextUrl;
  if (!password || isPreviewExempt(pathname)) return null;
  const cookie = req.cookies.get(PREVIEW_COOKIE)?.value ?? "";
  if (sameString(cookie, await previewToken(password))) return null;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ data: null, error: { code: "preview", message: "This site is in private preview." }, meta: {} }, { status: 401 });
  }
  const url = new URL("/preview", req.nextUrl);
  url.search = "";
  url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

/**
 * Roles from the session cookie, read only. Unlike the Auth.js middleware wrapper this never writes the
 * cookie back, so a background prefetch that finishes after sign out cannot restore the session.
 */
async function sessionRoles(req: NextRequest): Promise<readonly Role[] | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  // Secure (__Secure-) cookie on https, plain cookie on http; try both since a proxy may hide the scheme.
  for (const secureCookie of [true, false]) {
    const token = await getToken({ req, secret, secureCookie }).catch(() => null);
    if (token) return (token.roles as Role[] | undefined) ?? ["consumer"];
  }
  return null;
}

async function signInRules(req: NextRequest): Promise<NextResponse> {
  const { pathname, search } = req.nextUrl;
  const decision = accessFor(pathname, await sessionRoles(req));
  if (decision === "signin") {
    const url = new URL("/signin", req.nextUrl);
    url.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  if (decision === "forbidden") {
    // Signed in without the needed role: pro areas go to the pro landing, everything else home.
    return NextResponse.redirect(new URL(pathname.startsWith("/pro/") ? "/pro" : "/", req.nextUrl));
  }
  return NextResponse.next();
}

export default async function middleware(req: NextRequest) {
  const protectedPath = accessFor(req.nextUrl.pathname, null) !== "allow";
  const res = (await previewGate(req)) ?? (protectedPath ? await signInRules(req) : NextResponse.next());
  // Keep the whole preview out of search engines, including the password page.
  if (previewPassword()) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

// Every page and API route, so the preview lock covers the whole site; static files, images and the map
// worker are left out. Sign in rules apply only to the paths in RULES in lib/auth-access.ts.
export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|maplibre/|brand/|media/|icon\.png|apple-icon\.png|favicon\.ico).*)"],
};
