import { afterEach, describe, expect, it, vi } from "vitest";

// decideModeration for a partner agent goes through setProStatus, which resolves the queue item itself.
const calls: string[] = [];
let statusResult: { ok: true; status: string; openLeadIds: string[] } | { ok: false; code: string } = { ok: true, status: "active", openLeadIds: [] };
vi.mock("server-only", () => ({}));
vi.mock("@/lib/pros/status", () => ({
  setProStatus: async (_sql: unknown, proId: string, action: string) => {
    calls.push(`setProStatus ${proId} ${action}`);
    return statusResult;
  },
}));
vi.mock("@/db", () => {
  const sql = (strings: TemplateStringsArray) => {
    const text = strings.join("?");
    if (text.includes("from moderation_items") && text.includes("select")) return Promise.resolve([{ itemType: "pro", itemId: "pro-1" }]);
    if (text.trim().startsWith("update moderation_items")) {
      calls.push("resolve item");
      return Promise.resolve([{ itemType: "pro", itemId: "pro-1" }]);
    }
    return Promise.resolve([]);
  };
  return { sqlClient: sql };
});
const { decideModeration } = await import("@/server/data/admin");

describe("approving a partner agent from the queue", () => {
  afterEach(() => {
    calls.length = 0;
    statusResult = { ok: true, status: "active", openLeadIds: [] };
  });

  it("changes the agent's status through setProStatus and does not resolve the item on its own", async () => {
    expect(await decideModeration("item-1", "approve", null, "admin-1")).toEqual({ itemType: "pro", itemId: "pro-1" });
    expect(calls).toEqual(["setProStatus pro-1 approve"]);
  });

  it("leaves the item in the queue when the status change fails", async () => {
    statusResult = { ok: false, code: "bad_transition" };
    expect(await decideModeration("item-1", "reject", "Wrong license", "admin-1")).toBeNull();
    expect(calls).toEqual(["setProStatus pro-1 reject"]);
  });
});
