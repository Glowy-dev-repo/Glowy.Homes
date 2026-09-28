import { z } from "zod";
import { PREVIEW_COOKIE, PREVIEW_MAX_AGE, previewPassword, previewToken, safeNext, sameString } from "@/lib/preview";
import { fail, invalid, ok } from "@/server/api/respond";
import { clientIp, createRateLimiter } from "@/server/api/rate-limit";

const Body = z.object({ password: z.string().min(1, "Enter the password.").max(200), next: z.string().max(2000).optional() });

// Guessing is capped at 5 tries a minute per address.
const tries = createRateLimiter(5);

export async function POST(req: Request) {
  if (!tries(clientIp(req))) return fail(429, { code: "rate_limited", message: "Too many tries. Wait a minute and try again." });
  const expected = previewPassword();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  const next = safeNext(parsed.data.next);
  if (!expected) return ok({ next });
  if (!sameString(parsed.data.password, expected)) {
    return fail(401, { code: "wrong_password", message: "That password is not right. Check it and try again." });
  }
  const res = ok({ next });
  res.cookies.set(PREVIEW_COOKIE, await previewToken(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https:"),
    path: "/",
    maxAge: PREVIEW_MAX_AGE,
  });
  return res;
}
