import { formatPrice } from "@/lib/format";
import type { ValuationPoint } from "@/types/valuation";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const label = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;

/**
 * 12 month value history (docs/01 V3): a line chart with labelled axes plus a table alternative
 * for screen readers and keyboard users (ui-ux-pro-max chart rules).
 */
export function ValueHistoryChart({ points }: { points: ValuationPoint[] }) {
  if (points.length < 2) return <p className="text-body text-neutral-600">Not enough history yet.</p>;
  const w = 640;
  const h = 220;
  const pad = { l: 64, r: 12, t: 12, b: 28 };
  const values = points.map((p) => p.amount);
  const min = Math.min(...values) * 0.98;
  const max = Math.max(...values) * 1.02;
  const x = (i: number) => pad.l + (i / (points.length - 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * (h - pad.t - pad.b);
  const ticks = [min, (min + max) / 2, max];
  const change = ((values.at(-1)! - values[0]) / values[0]) * 100;

  return (
    <figure>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-labelledby="value-history-caption">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="#e4e4e7" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="#52525b">
              {formatPrice(t, { compact: true })}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % 3 === 0 || i === points.length - 1 ? (
            <text key={p.month} x={x(i)} y={h - 8} textAnchor="middle" fontSize="12" fill="#52525b">
              {label(p.month)}
            </text>
          ) : null,
        )}
        <polyline fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinejoin="round" points={points.map((p, i) => `${x(i)},${y(p.amount)}`).join(" ")} />
        {points.map((p, i) => (
          <circle key={p.month} cx={x(i)} cy={y(p.amount)} r="3.5" fill="var(--color-accent)">
            <title>{`${label(p.month)}: ${formatPrice(p.amount)}`}</title>
          </circle>
        ))}
      </svg>
      <figcaption id="value-history-caption" className="mt-2 text-small text-neutral-600">
        Estimated value over the last 12 months, {change >= 0 ? "up" : "down"} {Math.abs(change).toFixed(1)}%. Earlier months are estimated from the current estimate and the local market trend.
      </figcaption>
      <details className="mt-2">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-small font-medium text-accent">Show as a table</summary>
        <table className="mt-2 w-full max-w-sm text-left text-small">
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-600">
              <th scope="col" className="py-1 font-medium">Month</th>
              <th scope="col" className="py-1 text-right font-medium">Estimated value</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.month} className="border-b border-neutral-100">
                <td className="py-1">{label(p.month)}</td>
                <td className="tabular py-1 text-right">{formatPrice(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
