import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { signOutAction } from "@/server/actions/auth";

export const metadata: Metadata = {
  title: "Your account",
  description: "Saved homes, saved searches, tours and settings.",
  alternates: { canonical: "/account" },
  robots: { index: false },
};

export default async function AccountPage() {
  // Middleware already guards this route; the check here protects against misconfigured matchers.
  const session = await auth();
  if (!session?.user) redirect("/signin?callbackUrl=/account");

  return (
    <div className="container-page py-10">
      <h1 className="text-h1">Your account</h1>
      <p className="mt-2 text-body text-neutral-600" data-testid="signed-in-as">
        Signed in as {session.user.email}
      </p>
      <form action={signOutAction} className="mt-6">
        <Button type="submit" variant="secondary">
          Sign out
        </Button>
      </form>
    </div>
  );
}
