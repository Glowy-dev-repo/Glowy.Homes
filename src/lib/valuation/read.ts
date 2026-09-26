import { sqlClient } from "@/db";
import type { Confidence, PropertyEstimate, ValuationComp } from "@/types/valuation";

type Row = {
  kind: "value" | "rent";
  amount: number;
  low: number;
  high: number;
  confidence: Confidence;
  computedAt: string;
  modelVersion: string;
  comps: {
    property_id: string;
    address?: string;
    sold_price: number;
    sold_at: string;
    distance_m: number;
    adj_price: number;
    weight: number;
    beds?: number | null;
    baths?: number | null;
    sqft?: number | null;
  }[];
  inputs: { insufficient_reason?: string };
};

/**
 * Latest value and rent estimate for a property plus a 12 month monthly history
 * (docs/02 GET /api/properties/[id]/valuation). Null estimate fields mean none computed yet.
 */
export async function getPropertyEstimate(propertyId: string): Promise<PropertyEstimate> {
  const [latest, history] = await Promise.all([
    sqlClient<Row[]>`
      select distinct on (kind) kind, amount, low, high, confidence, computed_at::text as "computedAt",
        model_version as "modelVersion", comps, inputs
      from valuations where property_id = ${propertyId}
      order by kind, computed_at desc`,
    sqlClient<{ month: string; amount: number }[]>`
      select to_char(m, 'YYYY-MM') as month, amount from (
        select distinct on (date_trunc('month', computed_at)) date_trunc('month', computed_at) as m, amount
        from valuations
        where property_id = ${propertyId} and kind = 'value' and computed_at >= now() - interval '12 months'
          and confidence is not null
        order by date_trunc('month', computed_at), computed_at desc
      ) x order by m`,
  ]);

  const value = latest.find((r) => r.kind === "value");
  const rent = latest.find((r) => r.kind === "rent");
  const toEstimate = (r: Row | undefined) =>
    r && r.amount > 0 ? { amount: r.amount, low: r.low, high: r.high, confidence: r.confidence, computedAt: r.computedAt } : null;

  const comps: ValuationComp[] = (value?.comps ?? []).map((c) => ({
    propertyId: c.property_id,
    address: c.address ?? "",
    soldPrice: c.sold_price,
    soldAt: c.sold_at,
    distanceM: c.distance_m,
    adjustedPrice: c.adj_price,
    weight: c.weight,
    beds: c.beds ?? null,
    baths: c.baths ?? null,
    sqft: c.sqft ?? null,
  }));

  return {
    value: toEstimate(value),
    rent: toEstimate(rent),
    history,
    comps,
    modelVersion: value?.modelVersion ?? null,
    insufficientReason: value && value.amount <= 0 ? (value.inputs.insufficient_reason ?? "Not enough data") : null,
  };
}
