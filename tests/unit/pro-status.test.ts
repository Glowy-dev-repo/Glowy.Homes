import { describe, expect, it } from "vitest";
import { nextProStatus, ProStatusChange, type ProStatusAction } from "@/lib/pros/status-rules";

const statuses = ["pending", "active", "suspended"] as const;
const actions: ProStatusAction[] = ["approve", "reject", "suspend", "reactivate"];
const allowed: Record<string, string> = {
  "pending:approve": "active",
  "pending:reject": "suspended",
  "active:suspend": "suspended",
  "suspended:reactivate": "active",
};

describe("nextProStatus", () => {
  for (const from of statuses) {
    for (const action of actions) {
      const key = `${from}:${action}`;
      it(`${key} gives ${allowed[key] ?? "nothing"}`, () => {
        expect(nextProStatus(from, action)).toBe(allowed[key] ?? null);
      });
    }
  }
});

describe("ProStatusChange", () => {
  it("needs a reason to reject or suspend", () => {
    expect(ProStatusChange.safeParse({ action: "suspend" }).success).toBe(false);
    expect(ProStatusChange.safeParse({ action: "reject", reason: "  " }).success).toBe(false);
    expect(ProStatusChange.safeParse({ action: "suspend", reason: "No replies to clients" }).success).toBe(true);
  });

  it("does not need a reason to approve or reactivate", () => {
    expect(ProStatusChange.safeParse({ action: "approve" }).success).toBe(true);
    expect(ProStatusChange.safeParse({ action: "reactivate" }).success).toBe(true);
    expect(ProStatusChange.safeParse({ action: "delete" }).success).toBe(false);
  });
});
