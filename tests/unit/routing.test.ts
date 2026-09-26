import { describe, expect, it } from "vitest";
import { decideRoute, rankCandidates, responseWindowMs, scoreLead, type Candidate, type RouteInput } from "@/lib/leads/routing";

// docs/05 Phase 4 criterion 2: routing respects service area and daily cap, in 20 scenarios.

const pro = (id: string, over: Partial<Candidate> = {}): Candidate => ({
  proId: id,
  proType: "agent",
  status: "active",
  isAccepting: true,
  capPerDay: 10,
  assignedToday: 0,
  responseTimeMinutes: 15,
  rating: 4.5,
  areaMatch: "city",
  ...over,
});

const route = (candidates: Candidate[], over: Partial<RouteInput> = {}) =>
  decideRoute({ leadType: "tour", routeToListingAgent: false, exclude: [], candidates, ...over });

describe("routing scenarios", () => {
  const scenarios: [string, Candidate[], Partial<RouteInput>, string | null][] = [
    ["1. single covering agent gets the lead", [pro("a")], {}, "a"],
    ["2. agent with no service area never gets a lead", [pro("a", { areaMatch: null })], {}, null],
    ["3. only the covering agent of two gets it", [pro("a", { areaMatch: null }), pro("b")], {}, "b"],
    ["4. agent at daily cap is skipped", [pro("a", { assignedToday: 10 }), pro("b", { assignedToday: 3 })], {}, "b"],
    ["5. everyone at cap leaves the lead unassigned", [pro("a", { assignedToday: 10 }), pro("b", { capPerDay: 2, assignedToday: 2 })], {}, null],
    ["6. neighbourhood coverage beats city coverage", [pro("a", { areaMatch: "city", assignedToday: 0 }), pro("b", { areaMatch: "neighborhood", assignedToday: 5 })], {}, "b"],
    ["7. city coverage used when no neighbourhood agent is eligible", [pro("a", { areaMatch: "neighborhood", assignedToday: 10 }), pro("b", { areaMatch: "city" })], {}, "b"],
    ["8. fewest leads today wins", [pro("a", { assignedToday: 4 }), pro("b", { assignedToday: 1 })], {}, "b"],
    ["9. faster responder breaks a tie", [pro("a", { responseTimeMinutes: 40 }), pro("b", { responseTimeMinutes: 5 })], {}, "b"],
    ["10. higher rating breaks the next tie", [pro("a", { rating: 4.1 }), pro("b", { rating: 4.9 })], {}, "b"],
    ["11. suspended agents are skipped", [pro("a", { status: "suspended" }), pro("b", { assignedToday: 9 })], {}, "b"],
    ["12. pending agents are skipped", [pro("a", { status: "pending" })], {}, null],
    ["13. agents not accepting leads are skipped", [pro("a", { isAccepting: false }), pro("b")], {}, "b"],
    ["14. lenders never get tour leads", [pro("a", { proType: "lender" })], {}, null],
    ["15. preapproval goes to a covering lender", [pro("a"), pro("l", { proType: "lender" })], { leadType: "preapproval" }, "l"],
    ["16. reassignment excludes the previous agent", [pro("a"), pro("b", { assignedToday: 5 })], { exclude: ["a"] }, "b"],
    ["17. listing agent is not used by default", [pro("la", { assignedToday: 0 }), pro("b", { assignedToday: 0, responseTimeMinutes: 1 })], { listingAgentId: "la" }, "b"],
    ["18. listing agent used when configured", [pro("la", { assignedToday: 3 }), pro("b")], { listingAgentId: "la", routeToListingAgent: true }, "la"],
    ["19. consumer requested agent is honoured even outside their area", [pro("r", { areaMatch: null }), pro("b")], { requestedProId: "r", leadType: "contact" }, "r"],
    ["20. requested agent at cap falls back to area routing", [pro("r", { assignedToday: 10 }), pro("b")], { requestedProId: "r", leadType: "contact" }, "b"],
  ];

  for (const [name, candidates, over, expected] of scenarios) {
    it(name, () => {
      const d = route(candidates, over);
      expect(d.assign).toBe(expected);
      if (expected === null) expect(d.reason.length).toBeGreaterThan(0);
    });
  }

  it("rental inquiries go straight to the listing owner", () => {
    expect(route([pro("a")], { leadType: "rental_inquiry", listingOwnerProId: "owner" }).assign).toBe("owner");
  });

  it("explains why nothing was assigned", () => {
    expect(route([]).reason).toBe("no agent covers this area");
    expect(route([pro("a", { assignedToday: 10 })]).reason).toMatch(/daily cap/);
  });

  it("ranks stably", () => {
    expect(rankCandidates([pro("b"), pro("a")]).map((c) => c.proId)).toEqual(["a", "b"]);
  });
});

describe("lead score", () => {
  it("adds the docs/03 points and caps at 100", () => {
    const base = { loggedIn: false, hasPhone: false, savedHomes: 0, listingsViewed7d: 0, listingInTop30PctOfCity: false };
    expect(scoreLead({ ...base, leadType: "tour" })).toBe(30);
    expect(scoreLead({ ...base, leadType: "rental_inquiry", loggedIn: true, hasPhone: true })).toBe(35);
    expect(scoreLead({ leadType: "sell", loggedIn: true, hasPhone: true, savedHomes: 3, listingsViewed7d: 5, listingInTop30PctOfCity: true })).toBe(95);
    expect(scoreLead({ leadType: "sell", loggedIn: true, hasPhone: true, savedHomes: 9, listingsViewed7d: 9, listingInTop30PctOfCity: true })).toBeLessThanOrEqual(100);
  });
});

describe("response window", () => {
  it("is 30 minutes for agents and 4 hours for lenders unless overridden", () => {
    const saved = process.env.LEAD_REASSIGN_SECONDS;
    delete process.env.LEAD_REASSIGN_SECONDS;
    expect(responseWindowMs("agent")).toBe(1_800_000);
    expect(responseWindowMs("lender")).toBe(14_400_000);
    process.env.LEAD_REASSIGN_SECONDS = "5";
    expect(responseWindowMs("agent")).toBe(5000);
    if (saved === undefined) delete process.env.LEAD_REASSIGN_SECONDS;
    else process.env.LEAD_REASSIGN_SECONDS = saved;
  });
});
