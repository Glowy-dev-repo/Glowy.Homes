import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Check your email",
  description: "We sent you a sign in link.",
  alternates: { canonical: "/signin/check-email" },
  robots: { index: false },
};

export default function CheckEmailPage() {
  return (
    <div className="container-page flex justify-center py-12 md:py-20">
      <div className="w-full max-w-sm text-center">
        <MailCheck className="mx-auto size-10 text-accent" aria-hidden />
        <h1 className="mt-4 text-h1">Check your email</h1>
        <p className="mt-2 text-body text-neutral-600">
          We sent you a link to sign in. It expires in 24 hours. If you do not see it, check your spam folder.
        </p>
        <Link href="/signin" className="mt-6 inline-flex min-h-11 items-center text-accent hover:underline">
          Use a different email
        </Link>
      </div>
    </div>
  );
}
