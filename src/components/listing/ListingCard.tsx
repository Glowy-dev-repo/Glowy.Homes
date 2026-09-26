"use client";

import Image from "next/image";
import Link from "next/link";
import { formatArea, formatBaths, formatBeds, formatPrice, listedAgo, propertyTypeLabel } from "@/lib/format";
import { recordRecentlyViewed } from "@/lib/recently-viewed";
import { addressSlug } from "@/lib/slug";
import { cn } from "@/lib/utils";
import type { ListingSummary } from "@/types/search";
import { StatusBadge } from "./StatusBadge";

export type ListingCardSize = "default" | "compact" | "wide";

export function listingHref(l: Pick<ListingSummary, "id" | "addressLine1" | "addressLine2" | "city">): string {
  return `/listing/${l.id}/${addressSlug(l.addressLine1, l.addressLine2, l.city)}`;
}

/**
 * docs/04 ListingCard: photo 3:2 with status badge, price, facts, address, listed ago and
 * brokerage attribution. The whole card is a link.
 */
export function ListingCard({
  listing: l,
  size = "default",
  highlighted = false,
  priority = false,
  onHoverChange,
  action,
}: {
  listing: ListingSummary;
  size?: ListingCardSize;
  highlighted?: boolean;
  priority?: boolean;
  onHoverChange?: (id: string | null) => void;
  /** Slot for the save button (Phase 2), positioned over the photo. */
  action?: React.ReactNode;
}) {
  const address = [l.addressLine2, l.addressLine1].filter(Boolean).join(", ");
  const closed = l.status === "sold" || l.status === "leased";
  const price = closed && l.soldPrice ? l.soldPrice : l.price;
  const facts = [formatBeds(l.beds), formatBaths(l.baths), formatArea(l.sqft)].filter(Boolean);
  const wide = size === "wide";
  const compact = size === "compact";

  return (
    <article
      data-testid="listing-card"
      data-listing-id={l.id}
      onMouseEnter={() => onHoverChange?.(l.id)}
      onMouseLeave={() => onHoverChange?.(null)}
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-white shadow-card transition-shadow duration-200 hover:shadow-raised",
        highlighted ? "border-accent ring-2 ring-accent/30" : "border-neutral-200",
        wide && "flex",
      )}
    >
      <div className={cn("relative bg-neutral-100", wide ? "w-2/5 shrink-0" : "aspect-[3/2]", compact && "aspect-[16/9]")}>
        {l.coverKey ? (
          <Image
            src={l.coverKey}
            alt={`Photo of ${address}, ${l.city}`}
            fill
            sizes={wide ? "(min-width: 768px) 240px, 40vw" : compact ? "280px" : "(min-width: 1280px) 340px, (min-width: 640px) 50vw, 100vw"}
            placeholder={l.coverBlur ? "blur" : "empty"}
            blurDataURL={l.coverBlur ?? undefined}
            priority={priority}
            className="object-cover"
          />
        ) : null}
        <StatusBadge status={l.status} listingType={l.listingType} className="absolute left-2 top-2" />
        {l.isFeatured && (
          <span className="absolute bottom-2 left-2 rounded-sm bg-neutral-900/85 px-2 py-0.5 text-[12px] font-semibold text-white">
            Featured
          </span>
        )}
        {action && <div className="absolute right-1 top-1 z-10">{action}</div>}
      </div>
      <div className={cn("min-w-0 space-y-0.5", compact ? "p-3" : "p-4")}>
        <p className="tabular text-price text-neutral-900">
          {closed && <span className="mr-1 text-body font-medium text-neutral-600">{l.status === "sold" ? "Sold" : "Leased"}</span>}
          {formatPrice(price, { listingType: l.listingType })}
        </p>
        <p className="text-body text-neutral-700">
          {facts.length ? facts.join("  ·  ") : propertyTypeLabel(l.propertyType)}
        </p>
        <h3 className="truncate text-body font-normal text-neutral-900">
          <Link
            href={listingHref(l)}
            onClick={() => recordRecentlyViewed(l)}
            className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-accent"
          >
            {address}, {l.city}
          </Link>
        </h3>
        {!compact && (
          <p className="truncate text-small text-neutral-600">
            {listedAgo(l.listDate)}
            {l.brokerageName ? ` · ${l.brokerageName}` : ""}
          </p>
        )}
      </div>
    </article>
  );
}

export function ListingCardSkeleton() {
  return (
    <div aria-hidden className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div className="aspect-[3/2] animate-pulse bg-neutral-100" />
      <div className="space-y-2 p-4">
        <div className="h-6 w-32 animate-pulse rounded-sm bg-neutral-100" />
        <div className="h-4 w-40 animate-pulse rounded-sm bg-neutral-100" />
        <div className="h-4 w-56 animate-pulse rounded-sm bg-neutral-100" />
      </div>
    </div>
  );
}
