import type { Confidence } from "@/types/valuation";

// ValuationModel interface and the comps_v1 model (docs/03 section 3). Pure: comps and the market
// index are passed in, so the maths is unit tested with fixtures and the database layer only
// gathers inputs.

export type Subject = {
  propertyType: string;
  sqft: number | null;
  beds: number | null;
  baths: number | null;
  yearBuilt: number | null;
  lotSqft?: number | null;
};

export type CompInput = {
  propertyId: string;
  address: string;
  soldPrice: number;
  soldAt: string; // YYYY-MM-DD
  distanceM: number;
  sqft: number;
  beds: number;
  baths: number | null;
  yearBuilt: number | null;
  lotSqft?: number | null;
};

export type ValuationInput = {
  subject: Subject;
  asOf: string; // YYYY-MM-DD
  comps: CompInput[];
  /** market_index(city, month) lookup: "YYYY-MM" -> median price per sqft index. */
  marketIndex: (month: string) => number | null;
  kind: "value" | "rent";
};

export type AdjustedComp = CompInput & { adjustedPrice: number; weight: number; monthsSinceSale: number };

export type ValuationResult = {
  amount: number;
  low: number;
  high: number;
  confidence: Confidence;
  comps: AdjustedComp[];
};

export type Insufficient = { insufficientData: true; reason: string };

export interface ValuationModel {
  version: string;
  estimate(input: ValuationInput): Promise<ValuationResult | Insufficient>;
}

export const MIN_COMPS = 3;
export const WIDEN_BELOW = 5;
export const MIN_HALF_WIDTH = 0.04;

export function monthsBetween(from: string, to: string): number {
  const a = new Date(`${from.slice(0, 10)}T00:00:00Z`);
  const b = new Date(`${to.slice(0, 10)}T00:00:00Z`);
  return Math.max(0, (b.getTime() - a.getTime()) / (30.4375 * 86_400_000));
}

/** docs/03 step 2: adjust a comp's sold price to the subject. */
export function adjustComp(subject: Subject, comp: CompInput, asOf: string, marketIndex: ValuationInput["marketIndex"]): number {
  const sqft = subject.sqft && comp.sqft ? Math.pow(subject.sqft / comp.sqft, 0.6) : 1;
  const beds = subject.beds !== null && comp.beds !== null ? 1 + 0.03 * (subject.beds - comp.beds) : 1;
  const baths = subject.baths !== null && comp.baths !== null ? 1 + 0.025 * (subject.baths - comp.baths) : 1;
  const age = subject.yearBuilt && comp.yearBuilt ? 1 + 0.002 * (subject.yearBuilt - comp.yearBuilt) : 1;
  const now = marketIndex(asOf.slice(0, 7));
  const then = marketIndex(comp.soldAt.slice(0, 7));
  const time = now && then ? now / then : 1;
  return comp.soldPrice * sqft * beds * baths * age * time;
}

/** docs/03 step 3: nearer, more recent and more similar comps count more. */
export function compWeight(subject: Subject, comp: CompInput, monthsSinceSale: number): number {
  let similarity = 1;
  if (subject.sqft && comp.sqft) {
    const diff = Math.abs(subject.sqft - comp.sqft) / subject.sqft;
    if (diff > 0.25) similarity *= Math.max(0.2, 1 - (diff - 0.25) * 2);
  }
  if (subject.beds !== null && comp.beds !== null) {
    const diff = Math.abs(subject.beds - comp.beds);
    if (diff > 1) similarity *= Math.max(0.2, 1 - (diff - 1) * 0.3);
  }
  return (1 / (1 + comp.distanceM / 1000)) * (1 / (1 + monthsSinceSale / 6)) * similarity;
}

/** Weighted quantile over (value, weight) pairs; q in [0, 1]. */
export function weightedQuantile(items: { value: number; weight: number }[], q: number): number {
  const sorted = [...items].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((s, i) => s + i.weight, 0);
  if (!sorted.length || total <= 0) return NaN;
  const target = q * total;
  let acc = 0;
  for (const item of sorted) {
    acc += item.weight;
    if (acc >= target) return item.value;
  }
  return sorted[sorted.length - 1].value;
}

/** docs/03 step 6. */
export function confidenceFor(comps: AdjustedComp[], amount: number, low: number, high: number): Confidence {
  const width = (high - low) / amount;
  const within3km = comps.filter((c) => c.distanceM <= 3000).length;
  if (within3km >= 8 && width < 0.12) return "high";
  if (comps.length >= 5 && width < 0.2) return "medium";
  return "low";
}

const round = (n: number, kind: "value" | "rent") => (kind === "rent" ? Math.round(n / 25) * 25 : Math.round(n / 1000) * 1000);

export const compsV1: ValuationModel = {
  version: "comps_v1",
  async estimate(input) {
    const { subject, comps, asOf, kind } = input;
    if (comps.length < MIN_COMPS) {
      return { insufficientData: true, reason: `Only ${comps.length} comparable ${kind === "rent" ? "leases" : "sales"} nearby` };
    }
    const adjusted: AdjustedComp[] = comps.map((c) => {
      const monthsSinceSale = monthsBetween(c.soldAt, asOf);
      return { ...c, monthsSinceSale, adjustedPrice: adjustComp(subject, c, asOf, input.marketIndex), weight: compWeight(subject, c, monthsSinceSale) };
    });
    const pairs = adjusted.map((c) => ({ value: c.adjustedPrice, weight: c.weight }));
    const amount = weightedQuantile(pairs, 0.5);
    let low = weightedQuantile(pairs, 0.2);
    let high = weightedQuantile(pairs, 0.8);
    low = Math.min(low, amount * (1 - MIN_HALF_WIDTH));
    high = Math.max(high, amount * (1 + MIN_HALF_WIDTH));
    const confidence = confidenceFor(adjusted, amount, low, high);
    return {
      amount: round(amount, kind),
      low: round(low, kind),
      high: round(high, kind),
      confidence,
      comps: adjusted.sort((a, b) => b.weight - a.weight),
    };
  },
};
