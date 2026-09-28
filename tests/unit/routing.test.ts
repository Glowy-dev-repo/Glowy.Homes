import { describe, expect, it } from "vitest";
import { decideRoute, rankCandidates, responseWindowMs, scoreLead, suitability, type Candidate, type RouteInput } from "@/lib/leads/routing";

// Lead routing by ZIP code: a lead goes to the most suitable partner agent covering the home's
// ZIP code, within daily caps (docs/05 Phase 4 criterion 2: 20 scenarios).

const pro = (id: string, over: Partial<Candidate> = {}): Candidate => ({
  proId: id,
  proType: "agent",
  status: "active",
  isAccepting: true,
  capPerDay: 10,
  assignedToday: 0,
  responseTimeMinutes: 15,
  rating: 4.5,
  zipMatch: true,
  priceFit: null,
  typeFit: null,
  ...over,
});

const route = (candidates: Candidate[], over: Partial<RouteInput> = {}) =>
  decideRoute({ leadType: "tour", zip: "90027", routeToListingAgent: false, exclude: [], candidates, ...over });

describe("routing scenarios", () => {
  const scenarios: [string, Candidate[], Partial<RouteInput>, string | null][] = [
    ["1. the only agent covering the ZIP code gets the lead", [pro("a")], {}, "a"],
    ["2. an agent not covering the ZIP code never gets it", [pro("a", { zipMatch: false })], {}, null],
    ["3. of two agents, only the one covering the ZIP code gets it", [pro("a", { zipMatch: false }), pro("b")], {}, "b"],
    ["4. an agent at their daily cap is skipped", [pro("a", { assignedToday: 10 }), pro("b", { assignedToday: 3 })], {}, "b"],
    ["5. everyone at cap leaves the lead unassigned", [pro("a", { assignedToday: 10 }), pro("b", { capPerDay: 2, assignedToday: 2 })], {}, null],
    ["6. a price in the agent's range beats an agent without a range", [pro("a", { assignedToday: 0 }), pro("b", { priceFit: true, assignedToday: 5 })], {}, "b"],
    ["7. an agent whose range misses the price ranks last", [pro("a", { priceFit: false }), pro("b", { assignedToday: 6 })], {}, "b"],
    ["8. a matching home type breaks a price tie", [pro("a", { priceFit: true }), pro("b", { priceFit: true, typeFit: true, assignedToday: 4 })], {}, "b"],
    ["9. price fit outranks home type fit", [pro("a", { typeFit: true }), pro("b", { priceFit: true })], {}, "b"],
    ["10. among equally suited agents, fewest leads today wins", [pro("a", { assignedToday: 4 }), pro("b", { assignedToday: 1 })], {}, "b"],
    ["11. then the faster responder", [pro("a", { responseTimeMinutes: 40 }), pro("b", { responseTimeMinutes: 5 })], {}, "b"],
    ["12. then the higher rating", [pro("a", { rating: 4.1 }), pro("b", { rating: 4.9 })], {}, "b"],
    ["13. suspended agents are skipped", [pro("a", { status: "suspended" }), pro("b", { assignedToday: 9 })], {}, "b"],
    ["14. pending agents are skipped", [pro("a", { status: "pending" })], {}, null],
    ["15. agents not accepting leads are skipped", [pro("a", { isAccepting: false }), pro("b")], {}, "b"],
    ["16. a lead without a ZIP code is left for an admin", [pro("a")], { zip: null }, null],
    ["17. reassignment excludes the previous agent", [pro("a"), pro("b", { assignedToday: 5 })], { exclude: ["a"] }, "b"],
    ["18. the listing agent is not used by default", [pro("la", { zipMatch: false }), pro("b")], { listingAgentId: "la" }, "b"],
    ["19. an agent the consumer asked for is honoured even outside their ZIP codes", [pro("r", { zipMatch: false }), pro("b")], { requestedProId: "r", leadType: "contact" }, "r"],
    ["20. a requested agent at cap falls back to ZIP routing", [pro("r", { assignedToday: 10 }), pro("b")], { requestedProId: "r", leadType: "contact" }, "b"],
    ["21. only agents take leads, not landlords", [pro("a", { proType: "landlord" })], {}, null],
  ];

  for (const [name, candidates, over, expected] of scenarios) {
    it(name, () => {
      const d = route(candidates, over);
      expect(d.assign).toBe(expected);
      if (expected === null) expect(d.reason.length).toBeGreaterThan(0);
    });
  }

  it("rentals posted by their landlord go straight to the landlord", () => {
    expect(route([pro("a")], { leadType: "rental_inquiry", listingOwnerProId: "owner" }).assign).toBe("owner");
    expect(route([pro("a")], { leadType: "tour", listingOwnerProId: "owner" }).assign).toBe("owner");
    expect(route([pro("a")], { leadType: "sell", listingOwnerProId: "owner" }).assign).toBe("a");
  });

  it("explains the decision", () => {
    expect(route([]).reason).toBe("no agent covers ZIP 90027");
    expect(route([pro("a", { assignedToday: 10 })]).reason).toMatch(/daily cap/);
    expect(route([pro("a", { priceFit: true })]).reason).toMatch(/covers ZIP 90027, price in range/);
  });

  it("scores suitability and ranks stably", () => {
    expect(suitability(pro("a", { priceFit: true, typeFit: true }))).toBe(3);
    expect(suitability(pro("a", { priceFit: false, typeFit: false }))).toBe(-3);
    expect(rankCandidates([pro("b"), pro("a")]).map((c) => c.proId)).toEqual(["a", "b"]);
  });
});

describe("lead score", () => {
  it("adds the points and caps at 100", () => {
    const base = { loggedIn: false, hasPhone: false, savedHomes: 0, listingsViewed7d: 0, listingInTop30PctOfCity: false };
    expect(scoreLead({ ...base, leadType: "tour" })).toBe(30);
    expect(scoreLead({ ...base, leadType: "rental_inquiry", loggedIn: true, hasPhone: true })).toBe(35);
    expect(scoreLead({ leadType: "sell", loggedIn: true, hasPhone: true, savedHomes: 3, listingsViewed7d: 5, listingInTop30PctOfCity: true })).toBe(95);
    expect(scoreLead({ leadType: "sell", loggedIn: true, hasPhone: true, savedHomes: 9, listingsViewed7d: 9, listingInTop30PctOfCity: true })).toBeLessThanOrEqual(100);
  });
});

describe("response window", () => {
  it("is 30 minutes unless overridden", () => {
    const saved = process.env.LEAD_REASSIGN_SECONDS;
    delete process.env.LEAD_REASSIGN_SECONDS;
    expect(responseWindowMs()).toBe(1_800_000);
    process.env.LEAD_REASSIGN_SECONDS = "5";
    expect(responseWindowMs()).toBe(5000);
    if (saved === undefined) delete process.env.LEAD_REASSIGN_SECONDS;
    else process.env.LEAD_REASSIGN_SECONDS = saved;
  });
});
