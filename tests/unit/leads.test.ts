import { describe, expect, it } from "vitest";
import { financeRulesFor } from "@/config/market";
import { affordabilityRange, maxPrice, qualifyingRate } from "@/lib/affordability";
import { LeadInput } from "@/lib/leads/schema";
import { leadViewToken, verifyLeadViewToken } from "@/lib/leads/token";
import { ProSignup } from "@/lib/pros/schema";

const base = { name: "Pat", email: "pat@example.com", consent: true as const };
const listingId = "00000000-0000-4000-8000-000000000001";

describe("lead input", () => {
  it("requires consent", () => {
    expect(LeadInput.safeParse({ ...base, consent: false, leadType: "contact", listingId }).success).toBe(false);
  });

  it("requires time windows for tours and a listing for tours", () => {
    expect(LeadInput.safeParse({ ...base, leadType: "tour", listingId }).success).toBe(false);
    expect(LeadInput.safeParse({ ...base, leadType: "tour", tour: { mode: "video", windows: [{ date: "2026-10-01", slot: "morning" }] } }).success).toBe(false);
    expect(LeadInput.safeParse({ ...base, leadType: "tour", listingId, tour: { mode: "video", windows: [{ date: "2026-10-01", slot: "morning" }] } }).success).toBe(true);
  });

  it("lets a contact target a pro instead of a listing, and needs a city for preapproval", () => {
    expect(LeadInput.safeParse({ ...base, leadType: "contact", proId: listingId }).success).toBe(true);
    expect(LeadInput.safeParse({ ...base, leadType: "contact" }).success).toBe(false);
    expect(LeadInput.safeParse({ ...base, leadType: "preapproval" }).success).toBe(false);
    expect(LeadInput.safeParse({ ...base, leadType: "preapproval", citySlug: "los-angeles" }).success).toBe(true);
  });

  it("normalizes phone numbers and rejects bad ones", () => {
    expect(LeadInput.parse({ ...base, leadType: "sell", phone: "(416) 555-0100" }).phone).toBe("4165550100");
    expect(LeadInput.safeParse({ ...base, leadType: "sell", phone: "12" }).success).toBe(false);
  });
});

describe("lead status token", () => {
  it("verifies only the matching lead", () => {
    const t = leadViewToken(listingId);
    expect(verifyLeadViewToken(listingId, t)).toBe(true);
    expect(verifyLeadViewToken("00000000-0000-4000-8000-000000000002", t)).toBe(false);
    expect(verifyLeadViewToken(listingId, null)).toBe(false);
  });
});

describe("pro signup", () => {
  it("requires a license for agents but not landlords", () => {
    const common = { displayName: "Jo", phone: "4165550100", serviceAreaIds: [listingId] };
    expect(ProSignup.safeParse({ ...common, proType: "agent" }).success).toBe(false);
    expect(ProSignup.safeParse({ ...common, proType: "agent", licenseNumber: "123" }).success).toBe(true);
    expect(ProSignup.safeParse({ ...common, proType: "landlord" }).success).toBe(true);
    expect(ProSignup.safeParse({ ...common, proType: "landlord", serviceAreaIds: [] }).success).toBe(false);
  });
});

describe("affordability", () => {
  it("qualifies at the note rate in the US and at the stress test rate in Canada", () => {
    expect(qualifyingRate(4, financeRulesFor("US"))).toBe(4);
    expect(qualifyingRate(4, financeRulesFor("CA"))).toBe(6);
    expect(qualifyingRate(2, financeRulesFor("CA"))).toBe(5.25);
  });

  it("grows with income and down payment and gives a range", () => {
    const input = { annualIncome: 150_000, monthlyDebts: 500, downPayment: 100_000, ratePercent: 4.79 };
    const a = maxPrice(input);
    expect(a).toBeGreaterThan(400_000);
    expect(maxPrice({ ...input, annualIncome: 200_000 })).toBeGreaterThan(a);
    expect(maxPrice({ ...input, monthlyDebts: 2000 })).toBeLessThan(a);
    const r = affordabilityRange(input);
    expect(r.low).toBeLessThanOrEqual(r.mid);
    expect(r.high).toBeGreaterThanOrEqual(r.mid);
  });

  it("respects the minimum down payment", () => {
    // US: $30,000 down supports at most $1,000,000 (3% down).
    expect(maxPrice({ annualIncome: 1_000_000, monthlyDebts: 0, downPayment: 30_000, ratePercent: 4 }, 4, financeRulesFor("US"))).toBeLessThanOrEqual(1_000_000);
    // Canada: at most $550,000 (5% of 500K plus 10% of the rest).
    expect(maxPrice({ annualIncome: 1_000_000, monthlyDebts: 0, downPayment: 30_000, ratePercent: 4 }, 4, financeRulesFor("CA"))).toBeLessThanOrEqual(550_000);
  });
});
