import { ExternalLink, LogOut } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { brand } from "@/config/brand";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/server/api/pro";
import { signOutAction } from "@/server/actions/auth";
import { adminCounts } from "@/server/data/admin-dashboard";

// The admin area is its own app: its own menu, none of the public website's header, banners or footer.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Second check behind middleware (docs/02 section 8.5).
  // Checked against the database too: the role in the session cookie can be up to 30 days old.
  const session = await auth();
  if (!session?.user.roles.includes("admin") || !(await isAdmin(session.user.id))) notFound();
  const counts = await adminCounts();

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-50 lg:flex-row">
      <aside className="bg-navy px-3 py-3 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:shrink-0 lg:flex-col lg:px-4 lg:py-6">
        <div className="mb-3 flex items-center justify-between px-2 lg:mb-8 lg:block">
          <Link href="/admin" className="block text-white">
            <span className="block font-display text-[22px] leading-tight">{brand.name}</span>
            <span className="text-label uppercase tracking-[0.14em] text-blue-200">Admin</span>
          </Link>
        </div>
        <AdminNav counts={{ waiting: counts.waiting, approvals: counts.approvals }} />
        <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-white/10 pt-2 lg:mt-auto lg:block lg:space-y-1 lg:pt-4">
          <Link href="/" className="flex min-h-11 items-center gap-3 rounded-md px-3 text-body text-blue-100 hover:bg-white/5 hover:text-white">
            <ExternalLink className="size-5" aria-hidden /> View website
          </Link>
          <p className="hidden truncate px-3 pt-2 text-small text-blue-200 lg:block" title={session.user.email ?? undefined}>{session.user.email}</p>
          <form action={signOutAction}>
            <button type="submit" className="flex min-h-11 items-center gap-3 rounded-md px-3 text-left text-body text-blue-100 hover:bg-white/5 hover:text-white lg:w-full">
              <LogOut className="size-5" aria-hidden /> Sign out
            </button>
          </form>
        </div>
      </aside>
      <main id="main" className="min-w-0 flex-1 px-4 py-6 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
