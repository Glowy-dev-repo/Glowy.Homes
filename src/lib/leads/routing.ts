import type { LeadType } from "@/db/schema/leads";

// route_lead decision logic (docs/03 section 5). Pure functions: the database layer gathers
// candidates and signals, these decide. Unit tested with fixed scenarios.

export type ScoreSignals = {
  leadType: LeadType;
  loggedIn: boolean;
  hasPhone: boolean;
  savedHomes: number;
  listingsViewed7d: number;
  listingInTop30PctOfCity: boolean;
};

const TYPE_POINTS: Record<LeadType, number> = { tour: 30, contact: 20, sell: 40, preapproval: 25, rental_inquiry: 15, rental_application: 15 };

/** docs/03 step 1: 0 to 100. */
export function scoreLead(s: ScoreSignals): number {
  let score = TYPE_POINTS[s.leadType];
  if (s.loggedIn) score += 10;
  if (s.hasPhone) score += 10;
  if (s.savedHomes >= 3) score += 15;
  if (s.listingsViewed7d >= 5) score += 10;
  if (s.listingInTop30PctOfCity) score += 10;
  return Math.min(100, score);
}

/** docs/03 step 2. Landlord inquiries go straight to the listing owner when there is one. */
export function targetProType(leadType: LeadType): "agent" | "lender" {
  return leadType === "preapproval" ? "lender" : "agent";
}

export type Candidate = {
  proId: string;
  proType: string;
  status: string;
  isAccepting: boolean;
  capPerDay: number;
  assignedToday: number;
  responseTimeMinutes: number | null;
  rating: number | null;
  /** How the pro covers the lead's location: its neighbourhood, its city, or not at all. */
  areaMatch: "neighborhood" | "city" | null;
};

export type RouteInput = {
  leadType: LeadType;
  /** Pro the consumer asked for (contact from a pro profile). */
  requestedProId?: string | null;
  listingAgentId?: string | null;
  /** The listing's own owner (landlord or FSBO seller): rental inquiries go to them directly. */
  listingOwnerProId?: string | null;
  routeToListingAgent: boolean;
  /** Pros who already had this lead (reassignment). */
  exclude: string[];
  candidates: Candidate[];
};

export type RouteDecision =
  | { assign: string; reason: string; considered: string[] }
  | { assign: null; reason: string; considered: string[] };

const eligible = (c: Candidate, type: string, exclude: Set<string>) =>
  c.status === "active" && c.isAccepting && c.proType === type && c.assignedToday < c.capPerDay && !exclude.has(c.proId);

/** docs/03 step 5: fewest leads today, then fastest response, then best rating. */
export function rankCandidates(cs: Candidate[]): Candidate[] {
  return [...cs].sort(
    (a, b) =>
      a.assignedToday - b.assignedToday ||
      (a.responseTimeMinutes ?? 9999) - (b.responseTimeMinutes ?? 9999) ||
      (b.rating ?? 0) - (a.rating ?? 0) ||
      a.proId.localeCompare(b.proId),
  );
}

export function decideRoute(input: RouteInput): RouteDecision {
  const exclude = new Set(input.exclude);
  const type = targetProType(input.leadType);
  const byId = new Map(input.candidates.map((c) => [c.proId, c]));

  if ((input.leadType === "rental_inquiry" || input.leadType === "rental_application") && input.listingOwnerProId && !exclude.has(input.listingOwnerProId)) {
    return { assign: input.listingOwnerProId, reason: "listing owner (landlord)", considered: [input.listingOwnerProId] };
  }

  if (input.requestedProId && !exclude.has(input.requestedProId)) {
    const c = byId.get(input.requestedProId);
    if (c && c.status === "active" && c.isAccepting && c.assignedToday < c.capPerDay) {
      return { assign: c.proId, reason: "requested by the consumer", considered: [c.proId] };
    }
  }

  if (input.routeToListingAgent && input.listingAgentId && type === "agent") {
    const c = byId.get(input.listingAgentId);
    if (c && eligible(c, "agent", exclude)) return { assign: c.proId, reason: "listing agent", considered: [c.proId] };
  }

  // docs/03 step 4: service area must contain the lead's region, neighbourhood first, then city.
  const pool = input.candidates.filter((c) => c.areaMatch !== null && eligible(c, type, exclude));
  const considered = pool.map((c) => c.proId);
  const neighbourhood = rankCandidates(pool.filter((c) => c.areaMatch === "neighborhood"));
  if (neighbourhood.length) return { assign: neighbourhood[0].proId, reason: "neighbourhood coverage, fewest leads today", considered };
  const city = rankCandidates(pool.filter((c) => c.areaMatch === "city"));
  if (city.length) return { assign: city[0].proId, reason: "city coverage, fewest leads today", considered };

  const covering = input.candidates.filter((c) => c.areaMatch !== null && c.proType === type);
  const reason = !covering.length
    ? `no ${type} covers this area`
    : covering.every((c) => c.assignedToday >= c.capPerDay || exclude.has(c.proId))
      ? "every covering pro is at their daily cap or already had this lead"
      : "no covering pro is active and accepting leads";
  return { assign: null, reason, considered };
}

/** docs/03 step 9: how long a pro has to respond before reassignment. */
export function responseWindowMs(proType: string): number {
  const override = Number(process.env.LEAD_REASSIGN_SECONDS);
  if (Number.isFinite(override) && override > 0) return override * 1000;
  return proType === "lender" ? 4 * 3600_000 : 30 * 60_000;
}
