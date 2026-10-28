import { describe, expect, it } from "vitest";
import { AgentInvite } from "@/lib/pros/invite";

describe("AgentInvite", () => {
  it("lowercases and trims the email", () => {
    const r = AgentInvite.safeParse({ email: "  Dana.Reyes@KW.com ", name: " Dana Reyes " });
    expect(r.success && r.data).toEqual({ email: "dana.reyes@kw.com", name: "Dana Reyes" });
  });

  it("refuses an address that is not an email", () => {
    const r = AgentInvite.safeParse({ email: "dana at kw" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("Enter the agent's email address.");
  });

  it("does not need a name", () => {
    expect(AgentInvite.safeParse({ email: "a@b.co" }).success).toBe(true);
  });
});
