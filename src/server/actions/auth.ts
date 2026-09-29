"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/lib/auth";
import { safeNext } from "@/lib/preview";
import { rateLimitWrite } from "@/server/api/rate-limit";
import { signInEmailAllowed } from "@/server/api/signin-limit";

export type SignInState = { status: "idle" | "error"; message?: string; fieldError?: string; email?: string };

const SignInInput = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address, like name@example.com."),
  callbackUrl: z
    .string()
    .optional()
    // Only same site paths: never redirect to another origin.
    .transform((v) => (v ? safeNext(v) : "/account")),
});

export async function signInWithEmail(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = SignInInput.safeParse({
    email: formData.get("email"),
    callbackUrl: formData.get("callbackUrl") ?? undefined,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted field.",
      fieldError: parsed.error.issues[0]?.message,
      email: String(formData.get("email") ?? ""),
    };
  }

  const req = new Request("http://local", { headers: await headers() });
  if (rateLimitWrite(req) || !signInEmailAllowed(parsed.data.email)) {
    return { status: "error", message: "Too many sign in emails were requested. Wait a few minutes and try again.", email: parsed.data.email };
  }

  try {
    // redirect: false, then redirect ourselves: letting Auth.js redirect through /api/auth/verify-request
    // leaves the client router stuck on the API route.
    await signIn("resend", { email: parsed.data.email, redirectTo: parsed.data.callbackUrl, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) {
      return { status: "error", message: "We could not send your sign in link. Try again in a minute.", email: parsed.data.email };
    }
    throw err;
  }
  redirect("/signin/check-email");
}

export async function signInWithGoogle(formData: FormData) {
  const callbackUrl = String(formData.get("callbackUrl") ?? "/account");
  await signIn("google", { redirectTo: callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/account" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
