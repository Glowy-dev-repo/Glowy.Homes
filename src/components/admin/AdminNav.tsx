"use client";

import { BarChart3, Inbox, LayoutDashboard, MapPin, Settings, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Home", icon: LayoutDashboard, badge: null },
  { href: "/admin/leads", label: "Leads", icon: Inbox, badge: "waiting" },
  { href: "/admin/agents", label: "Agents", icon: Users, badge: null },
  { href: "/admin/zips", label: "ZIP codes", icon: MapPin, badge: null },
  { href: "/admin/moderation", label: "Approvals", icon: ShieldCheck, badge: "approvals" },
  { href: "/admin/funnel", label: "Reports", icon: BarChart3, badge: null },
  { href: "/admin/system", label: "Settings", icon: Settings, badge: null },
] as const;

/** Admin menu: a sidebar on desktop, a scrolling row of tabs on phones. Counts show what needs action. */
export function AdminNav({ counts }: { counts: { waiting: number; approvals: number } }) {
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {ITEMS.map(({ href, label, icon: Icon, badge }) => {
        const count = badge ? counts[badge] : 0;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active(href) ? "page" : undefined}
            className={cn(
              "flex min-h-11 shrink-0 items-center gap-3 rounded-md px-3 text-body font-medium transition-colors",
              active(href) ? "bg-white/10 text-white" : "text-blue-100 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            <span className="whitespace-nowrap">{label}</span>
            {count > 0 && (
              <span className="ml-auto rounded-pill bg-accent px-2 py-0.5 text-[12px] font-semibold text-white tabular" aria-label={`${count} need action`}>
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
