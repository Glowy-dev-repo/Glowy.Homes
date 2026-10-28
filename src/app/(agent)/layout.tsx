import { ExternalLink, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AgentNav } from "@/components/pro/AgentNav";
import { brand } from "@/config/brand";
import { sqlClient } from "@/db";
import { auth } from "@/lib/auth";
import { signOutAction } from "@/server/actions/auth";

// The partner agent workspace is its own area: its own menu, none of the public website's header,
// banners or footer. Middleware already limits /pro/* to agents and admins (lib/auth-access.ts); every
// page and API below still checks the pro profile and its status in the database.
export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/pro/dashboard");
  const [pro] = await sqlClient<{ id: string; status: string; slug: string; proType: string; name: string; waitingReply: number }[]>`
    select p.id, p.status, p.slug, p.pro_type as "proType", p.display_name as name,
      (select count(*)::int from leads x where x.assigned_pro_id = p.id and x.status = 'new' and x.first_response_at is null) as "waitingReply"
    from pros p where p.user_id = ${session.user.id}`;
  if (!pro) redirect("/pro/join");
  if (pro.proType === "landlord") redirect("/landlord");

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-50 lg:flex-row">
      <aside className="border-b border-neutral-200 bg-white px-3 py-3 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-b-0 lg:px-4 lg:py-6">
        <div className="mb-3 px-2 lg:mb-8">
          <Link href="/pro/dashboard" className="block">
            <span className="block font-display text-[22px] leading-tight text-neutral-900">{brand.name}</span>
            <span className="text-label uppercase tracking-[0.14em] text-accent">Partner agent</span>
          </Link>
        </div>
        <AgentNav waitingReply={pro.status === "active" ? pro.waitingReply : 0} />
        <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-neutral-200 pt-2 lg:mt-auto lg:block lg:space-y-1 lg:pt-4">
          {pro.status === "active" && (
            <Link href={`/agent/${pro.slug}`} className="flex min-h-11 items-center gap-3 rounded-md px-3 text-body text-neutral-700 hover:bg-neutral-100">
              <UserRound className="size-5" aria-hidden /> View my public profile
            </Link>
          )}
          <Link href="/" className="flex min-h-11 items-center gap-3 rounded-md px-3 text-body text-neutral-700 hover:bg-neutral-100">
            <ExternalLink className="size-5" aria-hidden /> View website
          </Link>
          <p className="hidden truncate px-3 pt-2 text-small text-neutral-600 lg:block" title={session.user.email ?? undefined}>
            {session.user.email}
          </p>
          <form action={signOutAction}>
            <button type="submit" className="flex min-h-11 items-center gap-3 rounded-md px-3 text-left text-body text-neutral-700 hover:bg-neutral-100 lg:w-full">
              <LogOut className="size-5" aria-hidden /> Sign out
            </button>
          </form>
        </div>
      </aside>
      <main id="main" className="min-w-0 flex-1 px-4 py-6 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-6xl">
          {pro.status === "pending" && (
            <p role="status" className="mb-6 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-body text-neutral-900" data-testid="pro-pending">
              We are verifying your license. You will start receiving leads once it is approved, typically within one business day.
            </p>
          )}
          {pro.status === "suspended" && (
            <p role="status" className="mb-6 rounded-md border border-danger/40 bg-danger/5 px-4 py-3 text-body text-neutral-900" data-testid="pro-suspended">
              Your partner account is paused, so new leads are not assigned to you. Contact {brand.supportEmail} to find out why.
            </p>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
