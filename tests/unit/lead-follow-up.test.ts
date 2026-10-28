import type postgres from "postgres";
import { afterEach, describe, expect, it, vi } from "vitest";

const sent: { to: string; subject: string }[] = [];
vi.mock("server-only", () => ({}));
vi.mock("@/lib/email", () => ({
  sendEmail: async (m: { to: string; subject: string }) => {
    sent.push({ to: m.to, subject: m.subject });
  },
}));
const { followUpAssigned } = await import("@/lib/leads/follow-up");

/** Answers the follow up's lead lookup and admin lookup from fixed rows; records routing log writes. */
function fakeSql(lead: Record<string, unknown> | null) {
  const writes: string[] = [];
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?");
    if (text.includes("from leads ld")) return Promise.resolve(lead ? [lead] : []);
    if (text.includes("from users where")) return Promise.resolve([{ email: "admin@example.com" }, { email: "konner@example.com" }]);
    if (text.trim().startsWith("update leads")) writes.push(JSON.stringify(values));
    return Promise.resolve([]);
  }) as unknown as postgres.Sql;
  (sql as unknown as { json: (v: unknown) => unknown }).json = (v) => v;
  return { sql, writes };
}

const assigned = (over: Record<string, unknown> = {}) => ({
  assigned: "pro-1", responded: false, status: "new", leadType: "tour", address: "12 Main St, Moorpark",
  assignedAt: new Date(Date.now() - 60 * 60_000).toISOString(), agentName: "Dana Reyes", agentEmail: "dana@example.com", ...over,
});

describe("follow up on a lead admin assigned", () => {
  afterEach(() => {
    sent.length = 0;
  });

  it("does nothing once the agent replied, the lead moved on, or it went to someone else", async () => {
    for (const lead of [assigned({ responded: true }), assigned({ status: "contacted" }), assigned({ assigned: "pro-2" }), null]) {
      const { sql, writes } = fakeSql(lead);
      expect(await followUpAssigned(sql, "lead-1", "pro-1", "remind")).toBe("responded");
      expect(writes).toHaveLength(0);
    }
    expect(sent).toHaveLength(0);
  });

  it("reminds the agent once when there is no reply", async () => {
    const { sql, writes } = fakeSql(assigned());
    expect(await followUpAssigned(sql, "lead-1", "pro-1", "remind")).toBe("reminded");
    expect(sent).toEqual([{ to: "dana@example.com", subject: "Reminder: a tour request is waiting for your reply" }]);
    expect(writes[0]).toContain('"action":"reminder_sent"');
  });

  it("tells every admin when there is still no reply, without reassigning", async () => {
    const { sql, writes } = fakeSql(assigned());
    expect(await followUpAssigned(sql, "lead-1", "pro-1", "escalate")).toBe("escalated");
    expect(sent.map((m) => m.to)).toEqual(["admin@example.com", "konner@example.com"]);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toContain('"action":"no_response"');
    expect(writes[0]).not.toContain("assigned_pro_id");
  });
});
