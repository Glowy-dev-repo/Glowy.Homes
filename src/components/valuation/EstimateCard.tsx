import Link from "next/link";
import { estimateLabel } from "@/config/copy";
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
  methodologyHref,
  agentOpinionHref,
  size = "default",
  className,
}: {
  estimate: PropertyEstimate | null;
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
        {estimateLabel}
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

      {estimate?.rent && (
        <dl className="mt-3 space-y-1 border-t border-neutral-200 pt-3 text-small">
          <div className="flex justify-between gap-3">
            <dt className="text-neutral-600">Rent estimate</dt>
            <dd className="tabular text-right text-neutral-900" data-testid="rent-estimate">
              {formatPrice(estimate.rent.low, { listingType: "rent" })} to {formatPrice(estimate.rent.high, { listingType: "rent" })}
            </dd>
          </div>
        </dl>
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
