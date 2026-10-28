import { describe, expect, it } from "vitest";
import { market } from "@/config/market";
import { LeadPatch } from "@/lib/leads/closing";

// Dates in the market's time zone, as the rule uses them.
const day = (offsetDays: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: market.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + offsetDays * 86_400_000));
const today = day(0);
const tomorrow = day(1);
const issue = (v: unknown, field: string) => {
  const r = LeadPatch.safeParse(v);
  return r.success ? null : (r.error.issues.find((i) => i.path[0] === field)?.message ?? null);
};

describe("LeadPatch", () => {
  it("asks for the sale price and closing date when a lead is closed", () => {
    expect(issue({ status: "closed" }, "closePrice")).toBe("Enter the sale price.");
    expect(issue({ status: "closed", closePrice: 750_000 }, "closeDate")).toBe("Enter the closing date.");
  });

  it("refuses a price of 0 or below and a closing date in the future", () => {
    expect(issue({ status: "closed", closePrice: 0, closeDate: today }, "closePrice")).not.toBeNull();
    expect(issue({ status: "closed", closePrice: -5, closeDate: today }, "closePrice")).not.toBeNull();
    expect(issue({ status: "closed", closePrice: 750_000, closeDate: tomorrow }, "closeDate")).toBe("The closing date cannot be in the future.");
  });

  it("accepts a closing with a price and today's date", () => {
    expect(LeadPatch.safeParse({ status: "closed", closePrice: 750_000, closeDate: today }).success).toBe(true);
  });

  it("only takes closing details with the Closed status", () => {
    expect(issue({ status: "contacted", closePrice: 750_000, closeDate: today }, "closePrice")).toBe("Sale details go with the Closed status.");
    expect(LeadPatch.safeParse({ status: "contacted" }).success).toBe(true);
    expect(LeadPatch.safeParse({ note: "Called, left a message" }).success).toBe(true);
    expect(LeadPatch.safeParse({}).success).toBe(false);
    expect(LeadPatch.safeParse({ status: "unassigned" }).success).toBe(false);
  });
});
