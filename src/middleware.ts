import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { accessFor } from "@/lib/auth-access";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const access = accessFor(pathname, req.auth?.user?.roles ?? null);

  if (access === "signin") {
    const url = new URL("/signin", req.nextUrl);
    url.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  if (access === "forbidden") {
    // Signed in without the needed role: pro areas go to the pro landing, everything else home.
    return NextResponse.redirect(new URL(pathname.startsWith("/pro/") ? "/pro" : "/", req.nextUrl));
  }
  return NextResponse.next();
});

// Must stay a literal for Next's static analysis; keep in sync with RULES in lib/auth-access.ts.
// Node runtime (stable in Next 15.5): Auth.js pulls in jose APIs the Edge runtime lacks.
export const config = {
  runtime: "nodejs",
  matcher: ["/account/:path*", "/pro/:path+", "/landlord/:path*", "/admin/:path*", "/sell/list"],
};
