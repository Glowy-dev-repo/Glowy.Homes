import type { NormalizedListing } from "./types";

export type ExistingListing = { status: string; price: number };

export type PlannedEvent = {
  eventType: "listed" | "price_change" | "pending" | "sold" | "leased" | "relisted" | "withdrawn" | "expired";
  price: number | null;
  date: string;
};

/**
 * Price history rows to write for an incoming record (docs/03 section 1.3 step c).
 * New listings use the feed's history when it has one; otherwise a listed event (plus the
 * closing event if the listing arrives already sold or leased). Existing listings get an event
 * only when status or price actually changed.
 */
export function planListingEvents(existing: ExistingListing | null, rec: NormalizedListing): PlannedEvent[] {
  if (!existing) {
    if (rec.history?.length) {
      return rec.history.map((h) => ({ eventType: h.eventType, price: h.price ?? null, date: h.date }));
    }
    const events: PlannedEvent[] = [{ eventType: "listed", price: rec.originalPrice ?? rec.price, date: rec.listDate }];
    if (rec.status !== "active") events.push(statusEvent(rec));
    return events;
  }

  const events: PlannedEvent[] = [];
  if (existing.status !== rec.status) events.push(statusEvent(rec, existing.status));
  const closing = rec.status === "sold" || rec.status === "leased";
  if (existing.price !== rec.price && !closing) {
    events.push({ eventType: "price_change", price: rec.price, date: rec.statusDate });
  }
  return events;
}

function statusEvent(rec: NormalizedListing, previous?: string): PlannedEvent {
  const date = rec.soldDate ?? rec.statusDate;
  switch (rec.status) {
    case "active":
      return { eventType: "relisted", price: rec.price, date: rec.statusDate };
    case "sold":
    case "leased":
      return { eventType: rec.status, price: rec.soldPrice ?? rec.price, date };
    case "pending":
    case "withdrawn":
    case "expired":
      return { eventType: rec.status, price: rec.price, date: rec.statusDate };
    default:
      throw new Error(`Unhandled status ${String(rec.status)} (was ${previous ?? "new"})`);
  }
}
