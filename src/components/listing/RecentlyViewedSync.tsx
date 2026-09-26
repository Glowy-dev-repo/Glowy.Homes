"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import { readRecentlyViewed, subscribeRecentlyViewed, writeRecentlyViewed, type RecentItem } from "@/lib/recently-viewed";

/**
 * Keeps recently viewed homes in the database for signed in users (docs/05 Phase 2 task 8):
 * pushes local views up, then pulls the account's list so it follows the user across devices.
 */
export function RecentlyViewedSync() {
  const { status } = useSession();
  const synced = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") {
      synced.current = false;
      return;
    }
    const push = async () => {
      const items = readRecentlyViewed().map((i) => ({ listingId: i.id, viewedAt: new Date(i.viewedAt).toISOString() }));
      const res = await fetch("/api/recently-viewed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      return res.ok;
    };
    const pull = async () => {
      const res = await fetch("/api/recently-viewed");
      if (!res.ok) return;
      const { data } = (await res.json()) as { data: RecentItem[] };
      writeRecentlyViewed(data);
    };

    if (!synced.current) {
      synced.current = true;
      void push().then(async (ok) => {
        if (ok) await pull();
      });
    }
    // Later local views are pushed as they happen.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeRecentlyViewed(() => {
      clearTimeout(timer);
      timer = setTimeout(() => void push(), 1000);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [status]);

  return null;
}
