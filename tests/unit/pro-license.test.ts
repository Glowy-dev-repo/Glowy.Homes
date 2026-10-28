import { describe, expect, it } from "vitest";
import { normalizeDreLicense } from "@/lib/pros/license";
import { ProSignup } from "@/lib/pros/schema";

const agent = {
  proType: "agent",
  displayName: "Dana Reyes",
  phone: "805 555 0100",
  licenseNumber: "01364089",
  zipCodes: ["93021"],
  agreeToTerms: true,
};

describe("normalizeDreLicense", () => {
  it("stores a DRE number as 8 digits however it was typed", () => {
    expect(normalizeDreLicense("01364089")).toBe("01364089");
    expect(normalizeDreLicense("1364089")).toBe("01364089");
    expect(normalizeDreLicense("DRE# 01364089")).toBe("01364089");
  });

  it("refuses empty input and numbers longer than 8 digits", () => {
    expect(normalizeDreLicense("")).toBeNull();
    expect(normalizeDreLicense("DRE")).toBeNull();
    expect(normalizeDreLicense("123456789")).toBeNull();
  });
});

describe("ProSignup", () => {
  it("saves the normalized license", () => {
    const r = ProSignup.safeParse({ ...agent, licenseNumber: "DRE# 1364089" });
    expect(r.success && r.data.licenseNumber).toBe("01364089");
  });

  it("asks an agent for a valid DRE number", () => {
    const r = ProSignup.safeParse({ ...agent, licenseNumber: "123456789" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.find((i) => i.path[0] === "licenseNumber")?.message).toBe("Enter your 8 digit California DRE license number.");
  });

  it("requires an agent to accept the partner agreement", () => {
    const r = ProSignup.safeParse({ ...agent, agreeToTerms: undefined });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path[0] === "agreeToTerms")).toBe(true);
  });

  it("does not ask a landlord for the agreement or a license", () => {
    const r = ProSignup.safeParse({ proType: "landlord", displayName: "Lee Park", phone: "805 555 0101" });
    expect(r.success).toBe(true);
  });
});

describe("partner agreement version label", () => {
  it("is readable and has no dashes (CLAUDE.md rule 10)", async () => {
    const { agreementLabel, PARTNER_AGREEMENT_VERSION } = await import("@/lib/pros/license");
    expect(agreementLabel(PARTNER_AGREEMENT_VERSION)).toBe("October 2026 draft");
    expect(agreementLabel("2027-03")).toBe("March 2027");
    expect(agreementLabel(null)).toBe("not recorded");
    expect(agreementLabel(PARTNER_AGREEMENT_VERSION)).not.toMatch(/-/);
  });
});
