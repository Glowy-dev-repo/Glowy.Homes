import { describe, expect, it } from "vitest";
import { accessFor } from "@/lib/auth-access";

describe("accessFor", () => {
  it("leaves public pages open", () => {
    expect(accessFor("/", null)).toBe("allow");
    expect(accessFor("/search", null)).toBe("allow");
    expect(accessFor("/pro", null)).toBe("allow");
    expect(accessFor("/accounting", null)).toBe("allow");
  });

  it("sends signed out visitors to sign in for protected areas", () => {
    for (const path of ["/account", "/account/homes", "/pro/leads", "/landlord", "/admin", "/admin/feeds"]) {
      expect(accessFor(path, null), path).toBe("signin");
    }
  });

  it("lets any signed in user into account and landlord areas", () => {
    expect(accessFor("/account", ["consumer"])).toBe("allow");
    expect(accessFor("/landlord/listings/new", ["consumer"])).toBe("allow");
  });

  it("lets any signed in user open the pro signup", () => {
    expect(accessFor("/pro/join", null)).toBe("signin");
    expect(accessFor("/pro/join", ["consumer"])).toBe("allow");
  });

  it("requires a pro role for the pro workspace", () => {
    expect(accessFor("/pro/leads", ["consumer"])).toBe("forbidden");
    expect(accessFor("/pro/leads", ["consumer", "agent"])).toBe("allow");
    expect(accessFor("/pro/leads", ["lender"])).toBe("forbidden");
  });

  it("requires admin for admin", () => {
    expect(accessFor("/admin", ["consumer", "agent"])).toBe("forbidden");
    expect(accessFor("/admin", ["admin"])).toBe("allow");
  });
});
