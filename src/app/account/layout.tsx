import { redirect } from "next/navigation";
import { AccountNav } from "@/components/account/AccountNav";
import { auth } from "@/lib/auth";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  // Middleware already guards /account; this protects against a misconfigured matcher.
  const session = await auth();
  if (!session?.user) redirect("/signin?callbackUrl=/account");

  return (
    <div className="container-page py-6 lg:py-10">
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* min-w-0: without it the scrolling tab strip widens the grid and the page scrolls sideways on phones. */}
        <aside className="min-w-0">
          <p className="mb-3 hidden text-small text-neutral-600 lg:block" data-testid="signed-in-as">
            Signed in as {session.user.email}
          </p>
          <AccountNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
