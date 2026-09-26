import { describe, expect, it } from "vitest";
import { EventBatch } from "@/lib/analytics/events";

describe("analytics event batches (docs/03 section 8)", () => {
  it("accepts known events with small flat props", () => {
    const r = EventBatch.safeParse({ events: [{ name: "search", props: { city: "toronto", type: "sale", area: false } }, { name: "page_view", props: { path: "/" }, at: 1790000000000 }] });
    expect(r.success).toBe(true);
    expect(r.data?.events[1].props).toEqual({ path: "/" });
  });

  it("rejects unknown event names, nested props and oversized batches", () => {
    expect(EventBatch.safeParse({ events: [{ name: "purchase", props: {} }] }).success).toBe(false);
    expect(EventBatch.safeParse({ events: [{ name: "search", props: { filters: { city: "toronto" } } }] }).success).toBe(false);
    expect(EventBatch.safeParse({ events: Array.from({ length: 51 }, () => ({ name: "page_view" })) }).success).toBe(false);
    expect(EventBatch.safeParse({ events: [] }).success).toBe(false);
  });

  it("limits the number of props per event", () => {
    const props = Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`k${i}`, i]));
    expect(EventBatch.safeParse({ events: [{ name: "search", props }] }).success).toBe(false);
  });
});
