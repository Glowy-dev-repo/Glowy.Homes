import type postgres from "postgres";
import { afterEach, describe, expect, it, vi } from "vitest";
import { leadAssignmentMode } from "@/lib/leads/assignment";
import { adminNewLeadEmail } from "@/lib/email/templates/leads";

const sent: { to: string; subject: string }[] = [];
vi.mock("server-only", () => ({}));
vi.mock("@/lib/email", () => ({
  sendEmail: async (m: { to: string; subject: string }) => {
    sent.push({ to: m.to, subject: m.subject });
  },
}));
const { routeLead } = await import("@/lib/leads/route");

/** A stand in for postgres.js that answers each routing query from fixed rows and records writes. */
function fakeSql(lead: Record<string, unknown>) {
  const writes: string[] = [];
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?");
    if (text.includes("from leads ld")) return Promise.resolve([lead]);
    if (text.includes("saved_homes")) return Promise.resolve([{ saved: 0, viewed: 0, top: false }]);
    if (text.includes("from pros pr")) {
      return Promise.resolve([
        { proId: "pro-zip", proType: "agent", status: "active", isAccepting: true, capPerDay: 10, assignedToday: 0, responseTimeMinutes: 20, rating: 4.8, zipMatch: true, priceFit: null, typeFit: null },
      ]);
    }
    if (text.includes("display_name as name")) return Promise.resolve([{ name: "Dana Reyes" }]);
    if (text.includes("from users")) return Promise.resolve([{ email: "admin@example.com" }]);
    if (text.trim().startsWith("update leads")) {
      writes.push(JSON.stringify(values));
      return Promise.resolve([]);
    }
    return Promise.resolve([]);
  }) as unknown as postgres.Sql;
  (sql as unknown as { json: (v: unknown) => unknown }).json = (v) => v;
  return { sql, writes };
}

const waitingLead = (routingLog: unknown[] = []) => ({
  id: "lead-1", leadType: "tour", status: "new", consumerUserId: null, consumerName: "Sam", consumerEmail: "sam@example.com",
  consumerPhone: null, message: null, payload: {}, assignedProId: null, routingLog, regionId: null, hoodId: null, cityId: null,
  regionName: "Moorpark", listingAgentId: null, listingOwnerProId: null, listingPrice: 900000, listingType: "sale",
  propertyType: "detached", zip: "93021", address: "12 Main St, Moorpark",
});

describe("routing when Glowy Homes chooses the agent", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    sent.length = 0;
  });

  it("holds the lead with the ZIP code's best agent as the suggestion, and emails admin and the customer", async () => {
    vi.stubEnv("LEAD_ASSIGNMENT", "admin");
    const { sql, writes } = fakeSql(waitingLead());
    const outcome = await routeLead(sql, "lead-1", "initial");
    expect(outcome).toEqual({ status: "awaiting_admin", suggestedProId: "pro-zip" });
    expect(writes).toHaveLength(1);
    expect(writes[0]).toContain('"action":"awaiting_admin"');
    expect(writes[0]).toContain('"suggested_pro_id":"pro-zip"');
    expect(writes[0]).not.toContain("assigned_pro_id");
    expect(sent).toEqual([
      { to: "admin@example.com", subject: "New tour request to assign in Moorpark" },
      { to: "sam@example.com", subject: "We received your tour request" },
    ]);
  });

  it("leaves a waiting lead alone on retries, so nothing is assigned or emailed twice", async () => {
    vi.stubEnv("LEAD_ASSIGNMENT", "admin");
    const { sql, writes } = fakeSql(waitingLead([{ at: "2026-10-19T00:00:00Z", action: "awaiting_admin", reason: "waiting" }]));
    expect((await routeLead(sql, "lead-1", "retry")).status).toBe("skipped");
    expect(writes).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });
});

describe("who chooses the agent for a new lead", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is Glowy Homes (admin) unless automatic assignment is turned on", () => {
    vi.stubEnv("LEAD_ASSIGNMENT", "");
    expect(leadAssignmentMode()).toBe("admin");
    vi.stubEnv("LEAD_ASSIGNMENT", "something else");
    expect(leadAssignmentMode()).toBe("admin");
    vi.stubEnv("LEAD_ASSIGNMENT", " AUTO ");
    expect(leadAssignmentMode()).toBe("auto");
  });

  it("emails admins the lead with the suggested agent and a link to assign it", () => {
    const mail = adminNewLeadEmail({ appUrl: "https://glowyhomes.com", leadId: "abc", leadType: "tour", region: "Moorpark", address: "12 Main St, Moorpark", suggestedAgent: "Dana Reyes" });
    expect(mail.subject).toBe("New tour request to assign in Moorpark");
    expect(mail.text).toContain("Suggested agent: Dana Reyes");
    expect(mail.link).toBe("https://glowyhomes.com/admin/leads?lead=abc");
    const none = adminNewLeadEmail({ appUrl: "https://glowyhomes.com", leadId: "abc", leadType: "contact", region: null, address: null, suggestedAgent: null });
    expect(none.text).toContain("No partner agent covers this ZIP code yet.");
  });
});
