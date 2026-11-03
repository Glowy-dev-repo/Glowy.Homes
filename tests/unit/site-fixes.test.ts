import { describe, expect, it, vi } from "vitest";
import { ClientEventBatch, EventBatch } from "@/lib/analytics/events";
import { formatDate, formatDistance } from "@/lib/format";
import { CONSENT_TEXT } from "@/lib/leads/schema";
import { SearchParams } from "@/types/search";

vi.mock("server-only", () => ({}));

describe("distances follow the market's units", () => {
  it("shows miles, and feet for short distances", () => {
    expect(formatDistance(1000)).toBe("0.6 mi");
    expect(formatDistance(4828)).toBe("3.0 mi");
    expect(formatDistance(60)).toBe("200 ft");
  });
});

describe("dates are the day in California", () => {
  it("shows a 9 pm Pacific lead on its own day, not the next UTC day", () => {
    expect(formatDate("2026-11-04 05:00:00+00")).toBe("Nov 3, 2026");
    expect(formatDate("2026-11-04 05:00:00.123456+00")).toBe("Nov 3, 2026");
  });
  it("leaves plain dates as they are", () => {
    expect(formatDate("2026-11-04")).toBe("Nov 4, 2026");
  });
});

describe("tour dates start tomorrow in California", () => {
  it("skips no day in the evening", async () => {
    const { nextDays } = await import("@/components/lead/LeadForm");
    // 6 pm Pacific on Nov 3 is already Nov 4 in UTC.
    expect(nextDays(2, new Date("2026-11-04T02:00:00Z"))).toEqual(["2026-11-04", "2026-11-05"]);
  });
});

describe("map search input", () => {
  it("refuses a drawn area outside the world instead of failing in the database", () => {
    const polygon = [[-200, 34], [-118, 34], [-118, 35]];
    expect(SearchParams.safeParse({ polygon }).success).toBe(false);
    expect(SearchParams.safeParse({ polygon: [[-119, 34], [-118, 34], [-118, 35]] }).success).toBe(true);
  });
});

describe("browser analytics", () => {
  it("cannot report server only events such as lead_submit", () => {
    expect(EventBatch.safeParse({ events: [{ name: "lead_submit" }] }).success).toBe(true);
    expect(ClientEventBatch.safeParse({ events: [{ name: "lead_submit" }] }).success).toBe(false);
    expect(ClientEventBatch.safeParse({ events: [{ name: "page_view" }] }).success).toBe(true);
  });
});

describe("lead consent", () => {
  it("names the Glowy Homes team", () => {
    expect(CONSENT_TEXT).toContain("Glowy Homes team");
  });
});

describe("AI search budget", () => {
  it("stops paid calls after the daily cap and starts again the next day", async () => {
    vi.stubEnv("NL_DAILY_LLM_CAP", "2");
    const { takeLlmBudget } = await import("@/lib/nl-search");
    const day = new Date("2026-11-03T12:00:00Z");
    expect([takeLlmBudget(day), takeLlmBudget(day), takeLlmBudget(day)]).toEqual([true, true, false]);
    expect(takeLlmBudget(new Date("2026-11-04T12:00:00Z"))).toBe(true);
    vi.unstubAllEnvs();
  });
});
