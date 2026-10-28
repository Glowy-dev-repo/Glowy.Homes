"use client";

import { Building2, Inbox, LayoutDashboard, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/pro/dashboard", label: "Overview", icon: LayoutDashboard, badge: false },
  { href: "/pro/leads", label: "Leads", icon: Inbox, badge: true },
  { href: "/pro/profile", label: "Profile", icon: UserRound, badge: false },
  { href: "/pro/listings", label: "Listings", icon: Building2, badge: false },
] as const;

/** Agent workspace menu: a sidebar on desktop, a scrolling row of tabs on phones (same pattern as admin). */
export function AgentNav({ waitingReply }: { waitingReply: number }) {
  const path = usePathname();
  return (
    <nav aria-label="Agent" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {ITEMS.map(({ href, label, icon: Icon, badge }) => {
        const active = path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 shrink-0 items-center gap-3 rounded-md px-3 text-body font-medium transition-colors",
              active ? "bg-accent/10 text-accent" : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900",
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            <span className="whitespace-nowrap">{label}</span>
            {badge && waitingReply > 0 && (
              <span className="tabular ml-auto rounded-pill bg-accent px-2 py-0.5 text-[12px] font-semibold text-white" aria-label={`${waitingReply} waiting for your reply`}>
                {waitingReply}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
