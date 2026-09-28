import type { LeadType } from "@/db/schema/leads";

// route_lead decision logic. GlowHomes is a lead generation business for real estate agents:
// a lead goes to the partner agent covering the home's ZIP code who suits it best. Pure functions:
// the database layer gathers candidates and signals, these decide. Unit tested with fixed scenarios.

export type ScoreSignals = {
  leadType: LeadType;
  loggedIn: boolean;
  hasPhone: boolean;
  savedHomes: number;
  listingsViewed7d: number;
  listingInTop30PctOfCity: boolean;
};

const TYPE_POINTS: Record<LeadType, number> = { tour: 30, contact: 20, sell: 40, rental_inquiry: 15, rental_application: 15 };

/** Lead quality, 0 to 100. */
export function scoreLead(s: ScoreSignals): number {
  let score = TYPE_POINTS[s.leadType];
  if (s.loggedIn) score += 10;
  if (s.hasPhone) score += 10;
  if (s.savedHomes >= 3) score += 15;
  if (s.listingsViewed7d >= 5) score += 10;
  if (s.listingInTop30PctOfCity) score += 10;
  return Math.min(100, score);
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
  /** The agent covers the lead's ZIP code. */
  zipMatch: boolean;
  /** The home's price is inside the agent's price range (null: the agent set no range, or no price). */
  priceFit: boolean | null;
  /** The home type is one the agent works with (null: the agent set no home types). */
  typeFit: boolean | null;
};

export type RouteInput = {
  leadType: LeadType;
  /** ZIP code of the home the lead is about, if any. */
  zip: string | null;
  /** Agent the consumer asked for (contact from an agent profile). */
  requestedProId?: string | null;
  listingAgentId?: string | null;
  /** The listing's own owner (a landlord posting a rental): rental inquiries go to them directly. */
  listingOwnerProId?: string | null;
  routeToListingAgent: boolean;
  /** Agents who already had this lead (reassignment). */
  exclude: string[];
  candidates: Candidate[];
};

export type RouteDecision =
  | { assign: string; reason: string; considered: string[] }
  | { assign: null; reason: string; considered: string[] };

const eligible = (c: Candidate, exclude: Set<string>) =>
  c.status === "active" && c.isAccepting && c.proType === "agent" && c.assignedToday < c.capPerDay && !exclude.has(c.proId);

/** How well an agent suits the lead: a price in their range counts most, then the home type. */
export function suitability(c: Candidate): number {
  const price = c.priceFit === true ? 2 : c.priceFit === false ? -2 : 0;
  const type = c.typeFit === true ? 1 : c.typeFit === false ? -1 : 0;
  return price + type;
}

/** Most suitable first, then fewest leads today, fastest response, best rating. */
export function rankCandidates(cs: Candidate[]): Candidate[] {
  return [...cs].sort(
    (a, b) =>
      suitability(b) - suitability(a) ||
      a.assignedToday - b.assignedToday ||
      (a.responseTimeMinutes ?? 9999) - (b.responseTimeMinutes ?? 9999) ||
      (b.rating ?? 0) - (a.rating ?? 0) ||
      a.proId.localeCompare(b.proId),
  );
}

export function decideRoute(input: RouteInput): RouteDecision {
  const exclude = new Set(input.exclude);
  const byId = new Map(input.candidates.map((c) => [c.proId, c]));

  // Rentals posted by their landlord on GlowHomes: inquiries go to the landlord.
  const ownerTypes: LeadType[] = ["tour", "contact", "rental_inquiry", "rental_application"];
  if (ownerTypes.includes(input.leadType) && input.listingOwnerProId && !exclude.has(input.listingOwnerProId)) {
    return { assign: input.listingOwnerProId, reason: "listing owner", considered: [input.listingOwnerProId] };
  }

  if (input.requestedProId && !exclude.has(input.requestedProId)) {
    const c = byId.get(input.requestedProId);
    if (c && c.status === "active" && c.isAccepting && c.assignedToday < c.capPerDay) {
      return { assign: c.proId, reason: "requested by the consumer", considered: [c.proId] };
    }
  }

  if (input.routeToListingAgent && input.listingAgentId) {
    const c = byId.get(input.listingAgentId);
    if (c && eligible(c, exclude)) return { assign: c.proId, reason: "listing agent", considered: [c.proId] };
  }

  if (!input.zip) return { assign: null, reason: "the lead has no ZIP code to match", considered: [] };

  // The agent must cover the home's ZIP code.
  const pool = input.candidates.filter((c) => c.zipMatch && eligible(c, exclude));
  const considered = pool.map((c) => c.proId);
  const ranked = rankCandidates(pool);
  if (ranked.length) {
    const best = ranked[0];
    const why = [best.priceFit ? "price in range" : null, best.typeFit ? "home type match" : null].filter(Boolean).join(", ");
    return { assign: best.proId, reason: `covers ZIP ${input.zip}${why ? `, ${why}` : ""}, fewest leads today among the best suited`, considered };
  }

  const covering = input.candidates.filter((c) => c.zipMatch && c.proType === "agent");
  const reason = !covering.length
    ? `no agent covers ZIP ${input.zip}`
    : covering.every((c) => c.assignedToday >= c.capPerDay || exclude.has(c.proId))
      ? "every agent covering this ZIP code is at their daily cap or already had this lead"
      : "no agent covering this ZIP code is active and accepting leads";
  return { assign: null, reason, considered };
}

/** How long an agent has to respond before the lead moves to the next suitable agent. */
export function responseWindowMs(): number {
  const override = Number(process.env.LEAD_REASSIGN_SECONDS);
  if (Number.isFinite(override) && override > 0) return override * 1000;
  return 30 * 60_000;
}
