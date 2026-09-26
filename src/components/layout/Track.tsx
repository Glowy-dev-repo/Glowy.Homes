"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { track } from "@/lib/analytics/client";
import type { EventName } from "@/lib/analytics/events";

/** Records one analytics event when a server rendered page mounts. */
export function Track({ name, props }: { name: EventName; props?: Record<string, string | number | boolean | null | undefined> }) {
  const key = JSON.stringify(props ?? {});
  useEffect(() => {
    track(name, JSON.parse(key) as Record<string, string | number | boolean | null>);
  }, [name, key]);
  return null;
}

/** page_view on every client side navigation. */
export function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    track("page_view", { path: pathname });
  }, [pathname]);
  return null;
}
