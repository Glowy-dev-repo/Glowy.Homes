import type { ValuationPoint } from "@/types/valuation";

/** 12 month value trend. Decorative next to the numbers, so it carries a text summary for screen readers. */
export function Sparkline({ points, className }: { points: ValuationPoint[]; className?: string }) {
  if (points.length < 2) return null;
  const w = 240;
  const h = 48;
  const values = points.map((p) => p.amount);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${((i / (points.length - 1)) * w).toFixed(1)},${(h - 4 - ((p.amount - min) / span) * (h - 8)).toFixed(1)}`)
    .join(" ");
  const change = ((values.at(-1)! - values[0]) / values[0]) * 100;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} role="img" aria-label={`Estimated value ${change >= 0 ? "up" : "down"} ${Math.abs(change).toFixed(1)} percent over ${points.length} months`}>
      <path d={d} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
