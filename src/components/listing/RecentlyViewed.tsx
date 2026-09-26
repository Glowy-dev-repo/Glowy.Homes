"use client";

import { useSyncExternalStore } from "react";
import { readRecentlyViewed, subscribeRecentlyViewed, type RecentItem } from "@/lib/recently-viewed";
import { ListingCard } from "./ListingCard";

let snapshot: RecentItem[] = [];
let snapshotKey = "";

function getSnapshot(): RecentItem[] {
  const items = readRecentlyViewed();
  const key = items.map((i) => `${i.id}:${i.viewedAt}`).join(",");
  if (key !== snapshotKey) {
    snapshotKey = key;
    snapshot = items;
  }
  return snapshot;
}

const empty: RecentItem[] = [];

/** Recently viewed homes (docs/01 S7), read from local storage. Renders nothing when empty. */
export function RecentlyViewed({ limit = 4 }: { limit?: number }) {
  const items = useSyncExternalStore(subscribeRecentlyViewed, getSnapshot, () => empty);
  if (!items.length) return null;
  return (
    <section aria-labelledby="recent-heading" className="container-page py-8" data-testid="recently-viewed">
      <h2 id="recent-heading" className="text-h2">
        Recently viewed
      </h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.slice(0, limit).map((item) => (
          <li key={item.id}>
            <ListingCard listing={item} size="compact" />
          </li>
        ))}
      </ul>
    </section>
  );
}
