import { describe, expect, it } from "vitest";
import { unsubscribeToken, verifyUnsubscribeToken } from "@/lib/alerts/token";
import { alertPeriodKey, alertSubject, isoWeek } from "@/lib/alerts/window";

describe("alert windows (docs/03 section 6)", () => {
  it("daily windows follow the Toronto calendar day, not UTC", () => {
    // 03:30 UTC on Sept 27 is still Sept 26 in Toronto.
    expect(alertPeriodKey("daily", new Date("2026-09-27T03:30:00Z"))).toBe("daily:2026-09-26");
    expect(alertPeriodKey("daily", new Date("2026-09-27T12:00:00Z"))).toBe("daily:2026-09-27");
  });

  it("two runs on the same day share a key, the next day does not", () => {
    const a = alertPeriodKey("daily", new Date("2026-09-26T12:00:00Z"));
    const b = alertPeriodKey("daily", new Date("2026-09-26T23:59:00Z"));
    const c = alertPeriodKey("daily", new Date("2026-09-27T12:10:00Z"));
    expect(a).toBe(b);
    expect(c).not.toBe(a);
  });

  it("weekly windows are ISO weeks starting Monday", () => {
    expect(alertPeriodKey("weekly", new Date("2026-09-28T12:00:00Z"))).toBe("weekly:2026-W40"); // Monday
    expect(alertPeriodKey("weekly", new Date("2026-10-04T12:00:00Z"))).toBe("weekly:2026-W40"); // Sunday
    expect(alertPeriodKey("weekly", new Date("2026-10-05T12:00:00Z"))).toBe("weekly:2026-W41");
    expect(isoWeek(2027, 1, 1)).toEqual({ year: 2026, week: 53 });
  });

  it("instant windows are 5 minutes long", () => {
    expect(alertPeriodKey("instant", new Date("2026-09-26T12:00:00Z"))).toBe(alertPeriodKey("instant", new Date("2026-09-26T12:04:59Z")));
    expect(alertPeriodKey("instant", new Date("2026-09-26T12:05:00Z"))).not.toBe(alertPeriodKey("instant", new Date("2026-09-26T12:04:59Z")));
  });

  it("subjects use the count and the search name", () => {
    expect(alertSubject(1, "Condos in Toronto")).toBe("1 new home in Condos in Toronto");
    expect(alertSubject(7, "Condos in Toronto")).toBe("7 new homes in Condos in Toronto");
  });

  it("unsubscribe tokens are bound to one saved search", () => {
    const id = "8a1f6c52-3e7b-4d2a-9f10-5b6c7d8e9f01";
    expect(verifyUnsubscribeToken(id, unsubscribeToken(id))).toBe(true);
    expect(verifyUnsubscribeToken("8a1f6c52-3e7b-4d2a-9f10-5b6c7d8e9f02", unsubscribeToken(id))).toBe(false);
    expect(verifyUnsubscribeToken(id, null)).toBe(false);
  });
});
