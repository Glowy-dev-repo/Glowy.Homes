import { describe, expect, it } from "vitest";
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

  it("lets a contact target an agent instead of a listing, and has no mortgage leads", () => {
    expect(LeadInput.safeParse({ ...base, leadType: "contact", proId: listingId }).success).toBe(true);
    expect(LeadInput.safeParse({ ...base, leadType: "contact" }).success).toBe(false);
    expect(LeadInput.safeParse({ ...base, leadType: "preapproval" }).success).toBe(false);
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

describe("partner signup", () => {
  const common = { displayName: "Jo", phone: "2135550100", zipCodes: ["90027"] };

  it("requires a license and at least one ZIP code for agents, neither for landlords", () => {
    expect(ProSignup.safeParse({ ...common, proType: "agent" }).success).toBe(false);
    expect(ProSignup.safeParse({ ...common, proType: "agent", licenseNumber: "02123456" }).success).toBe(true);
    expect(ProSignup.safeParse({ ...common, proType: "agent", licenseNumber: "02123456", zipCodes: [] }).success).toBe(false);
    expect(ProSignup.safeParse({ displayName: "Jo", phone: "2135550100", proType: "landlord" }).success).toBe(true);
  });

  it("checks ZIP codes and the price range", () => {
    const agent = { ...common, proType: "agent", licenseNumber: "02123456" };
    expect(ProSignup.safeParse({ ...agent, zipCodes: ["9002"] }).success).toBe(false);
    expect(ProSignup.safeParse({ ...agent, priceMin: 900_000, priceMax: 500_000 }).success).toBe(false);
    expect(ProSignup.safeParse({ ...agent, priceMin: 500_000, priceMax: 900_000, homeTypes: ["condo"] }).success).toBe(true);
    expect(ProSignup.safeParse({ ...agent, proType: "lender" }).success).toBe(false);
  });
});
