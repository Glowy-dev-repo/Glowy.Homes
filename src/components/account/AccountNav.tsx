"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { accountNav } from "@/config/nav";
import { cn } from "@/lib/utils";

/** docs/04 Account: left nav on desktop, scrolling tabs on mobile. */
export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Account">
      <ul className="-mx-4 flex gap-1 overflow-x-auto border-b border-neutral-200 px-4 lg:mx-0 lg:flex-col lg:border-b-0 lg:px-0">
        {accountNav.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center whitespace-nowrap px-3 text-body font-medium transition-colors lg:rounded-md",
                  active
                    ? "border-b-2 border-accent text-accent lg:border-b-0 lg:bg-accent/10"
                    : "text-neutral-700 hover:text-neutral-900 lg:hover:bg-neutral-100",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
