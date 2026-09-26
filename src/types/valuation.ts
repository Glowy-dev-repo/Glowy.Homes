export type Confidence = "low" | "medium" | "high";

export type ValuationPoint = { month: string; amount: number };

export type ValuationComp = {
  propertyId: string;
  address: string;
  soldPrice: number;
  soldAt: string;
  distanceM: number;
  adjustedPrice: number;
  weight: number;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
};

export type EstimateValue = { amount: number; low: number; high: number; confidence: Confidence; computedAt: string };

export type PropertyEstimate = {
  value: EstimateValue | null;
  rent: EstimateValue | null;
  history: ValuationPoint[];
  comps: ValuationComp[];
  modelVersion: string | null;
  insufficientReason: string | null;
};

/** docs/01 section 4.3: must appear near every estimate. */
export const ESTIMATE_DISCLAIMER =
  "This is an automated estimate, not an appraisal. Actual value depends on condition, market and a professional assessment.";

export const CONFIDENCE_EXPLANATION: Record<Confidence, string> = {
  high: "High: many recent nearby sales of similar homes, and they agree closely.",
  medium: "Medium: enough recent nearby sales, with some spread in their prices.",
  low: "Low: few recent nearby sales or a wide spread in prices. Treat this as a rough guide.",
};
