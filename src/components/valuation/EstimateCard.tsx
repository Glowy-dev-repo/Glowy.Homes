import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ESTIMATE_DISCLAIMER, type PropertyEstimate } from "@/types/valuation";
import { ConfidenceLabel } from "./ConfidenceRange";
import { Sparkline } from "./Sparkline";

/**
 * docs/04 EstimateCard. Every estimate shows a low to high range, a confidence label and the
 * docs/01 disclaimer (CLAUDE.md rule 8). With no estimate it shows the docs/04 unavailable state.
 */
export function EstimateCard({
  estimate,
  payment,
  methodologyHref,
  agentOpinionHref,
  size = "default",
  className,
}: {
  estimate: PropertyEstimate | null;
  payment?: { low: number; high: number } | null;
  methodologyHref: string;
  agentOpinionHref: string;
  size?: "default" | "large";
  className?: string;
}) {
  const value = estimate?.value ?? null;
  return (
    <section
      aria-labelledby="estimate-heading"
      data-testid="estimate-card"
      className={cn("rounded-lg border border-neutral-200 bg-white p-5", className)}
    >
      <h2 id="estimate-heading" className="text-label uppercase text-neutral-600">
        Our estimate
      </h2>

      {value ? (
        <>
          <p className={cn("tabular mt-1 font-bold text-neutral-900", size === "large" ? "text-display" : "text-price")} data-testid="estimate-value">
            {formatPrice(value.amount)}
          </p>
          <p className="tabular text-small text-neutral-600" data-testid="estimate-range">
            {formatPrice(value.low)} to {formatPrice(value.high)}
          </p>
          <div className="mt-1">
            <ConfidenceLabel confidence={value.confidence} />
          </div>
          {estimate && estimate.history.length > 1 && <Sparkline points={estimate.history} className="mt-2 h-12 w-full" />}
        </>
      ) : (
        <div className="mt-2" data-testid="estimate-unavailable">
          <p className="text-body text-neutral-800">Not enough recent sales nearby to estimate this home.</p>
          <Link href={agentOpinionHref} className="mt-1 inline-flex min-h-11 items-center font-medium text-accent hover:underline">
            Get an agent&apos;s opinion
          </Link>
        </div>
      )}

      {(estimate?.rent || payment) && (
        <dl className="mt-3 space-y-1 border-t border-neutral-200 pt-3 text-small">
          {estimate?.rent && (
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-600">Rent estimate</dt>
              <dd className="tabular text-right text-neutral-900" data-testid="rent-estimate">
                {formatPrice(estimate.rent.low, { listingType: "rent" })} to {formatPrice(estimate.rent.high, { listingType: "rent" })}
              </dd>
            </div>
          )}
          {payment && (
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-600">Estimated payment</dt>
              <dd className="tabular text-right text-neutral-900">
                <a href="#monthly-cost" className="hover:underline">
                  {formatPrice(Math.round(payment.low))} to {formatPrice(Math.round(payment.high))}/mo
                </a>
              </dd>
            </div>
          )}
        </dl>
      )}
      {payment && (
        <p className="mt-1 text-small text-neutral-600">
          Payment confidence: <span className="font-semibold text-neutral-800">Medium</span>. Assumes 20% down and a typical rate; not a loan offer.
        </p>
      )}

      {value && (
        <Link href={methodologyHref} className="mt-3 inline-flex min-h-11 items-center text-small font-medium text-accent hover:underline">
          See comps and methodology
        </Link>
      )}
      <p className="mt-2 text-small text-neutral-600" data-testid="estimate-disclaimer">
        {ESTIMATE_DISCLAIMER}
      </p>
    </section>
  );
}
