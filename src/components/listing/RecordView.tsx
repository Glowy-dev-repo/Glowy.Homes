"use client";

import { useEffect } from "react";
import { recordRecentlyViewed } from "@/lib/recently-viewed";
import type { ListingSummary } from "@/types/search";

/** Adds the listing to recently viewed; RecentlyViewedSync copies it to the account when signed in. */
export function RecordView({ listing }: { listing: ListingSummary }) {
  useEffect(() => {
    recordRecentlyViewed(listing);
  }, [listing]);
  return null;
}
