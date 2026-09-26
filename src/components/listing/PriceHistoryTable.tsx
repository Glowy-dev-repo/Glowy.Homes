"use client";

import { useState } from "react";
import { formatDate, formatPrice } from "@/lib/format";
import type { PriceEvent } from "@/lib/listings/detail";
import { cn } from "@/lib/utils";

const EVENT_LABELS: Record<string, string> = {
  listed: "Listed for sale",
  price_change: "Price change",
  pending: "Pending",
  sold: "Sold",
  leased: "Leased",
  relisted: "Relisted",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

const SOURCE_LABELS: Record<string, string> = {
  synthetic: "Demo feed",
  reso: "MLS",
  crea_ddf: "MLS",
  csv: "Brokerage import",
  fsbo: "Owner",
  landlord: "Landlord",
};

/**
 * docs/04 PriceHistoryTable: Date, Event, Price, Change (percent, colored with a sign so color
 * is not the only cue), Source. Newest first, collapsed to five rows.
 */
export function PriceHistoryTable({ events, listingType }: { events: PriceEvent[]; listingType: "sale" | "rent" }) {
  const [all, setAll] = useState(false);
  if (!events.length) return <p className="text-body text-neutral-600">No price history yet.</p>;

  // Change is relative to the previous priced event in time (the next row down).
  const rows = events.map((e, i) => {
    const prev = events.slice(i + 1).find((p) => p.price);
    const change = e.price && prev?.price && e.eventType !== "listed" ? ((e.price - prev.price) / prev.price) * 100 : null;
    return { ...e, change };
  });
  const shown = all ? rows : rows.slice(0, 5);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-body">
          <caption className="sr-only">Price history, newest first</caption>
          <thead>
            <tr className="border-b border-neutral-200 text-small text-neutral-600">
              <th scope="col" className="py-2 pr-3 font-medium">Date</th>
              <th scope="col" className="py-2 pr-3 font-medium">Event</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Price</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Change</th>
              <th scope="col" className="py-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-b border-neutral-100">
                <td className="py-2 pr-3 whitespace-nowrap">{formatDate(r.eventDate)}</td>
                <td className="py-2 pr-3">{r.eventType === "listed" && listingType === "rent" ? "Listed for rent" : (EVENT_LABELS[r.eventType] ?? r.eventType)}</td>
                <td className="tabular py-2 pr-3 text-right">{r.price ? formatPrice(r.price, { listingType }) : ""}</td>
                <td
                  className={cn(
                    "tabular py-2 pr-3 text-right",
                    r.change === null ? "text-neutral-500" : r.change < 0 ? "text-danger" : r.change > 0 ? "text-success" : "text-neutral-700",
                  )}
                >
                  {r.change === null ? "" : r.change === 0 ? "0%" : `${r.change > 0 ? "Up" : "Down"} ${Math.abs(r.change).toFixed(1)}%`}
                </td>
                <td className="py-2 text-neutral-600">{SOURCE_LABELS[r.source] ?? r.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 5 && (
        <button type="button" onClick={() => setAll((a) => !a)} className="mt-2 inline-flex min-h-11 items-center font-medium text-accent hover:underline">
          {all ? "Show less" : `Show all ${rows.length} events`}
        </button>
      )}
    </div>
  );
}
