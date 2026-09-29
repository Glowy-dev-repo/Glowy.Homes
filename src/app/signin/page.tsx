import type { Metadata } from "next";
import { EmailSignInForm } from "@/components/auth/EmailSignInForm";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { googleEnabled } from "@/lib/auth";
import { signInWithGoogle } from "@/server/actions/auth";

export const metadata: Metadata = {
  title: "Sign in",
  description: `Sign in to ${brand.name} to save homes, save searches and get alerts.`,
  alternates: { canonical: "/signin" },
  robots: { index: false },
};

const ERRORS: Record<string, string> = {
  Verification: "That sign in link has expired or was already used. Request a new one below.",
  OAuthAccountNotLinked: "That email is already linked to another sign in method. Use the email link instead.",
  TooMany: "Too many sign in emails were requested. Wait a few minutes and try again.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;
  const errorMessage = error ? (ERRORS[error] ?? "Something went wrong while signing you in. Try again.") : null;

  return (
    <div className="container-page flex justify-center py-12 md:py-20">
      <div className="w-full max-w-sm">
        <h1 className="text-h1">Sign in</h1>
        <p className="mt-2 text-body text-neutral-600">Save homes and searches, and get alerts when new homes match.</p>

        {errorMessage && (
          <p role="alert" className="mt-6 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-small text-danger">
            {errorMessage}
          </p>
        )}

        <div className="mt-6">
          <EmailSignInForm callbackUrl={callbackUrl} />
        </div>

        {googleEnabled && (
          <>
            <div className="my-6 flex items-center gap-3 text-small text-neutral-500">
              <span className="h-px flex-1 bg-neutral-200" />
              or
              <span className="h-px flex-1 bg-neutral-200" />
            </div>
            <form action={signInWithGoogle}>
              <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/account"} />
              <Button type="submit" variant="secondary" className="w-full">
                Continue with Google
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
