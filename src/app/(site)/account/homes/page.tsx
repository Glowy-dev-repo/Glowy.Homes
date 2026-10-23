import type { Metadata } from "next";
import Link from "next/link";
import { OwnerFactsForm } from "@/components/owner/OwnerFactsForm";
import { SellLeadDialog } from "@/components/owner/SellLeadDialog";
import { Button } from "@/components/ui/button";
import { EstimateCard } from "@/components/valuation/EstimateCard";
import { auth } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { claimedProperties, effectiveFacts, getPropertyDetail } from "@/lib/properties/detail";
import { addressSlug } from "@/lib/slug";
import { getOrComputeEstimate } from "@/lib/valuation/read";

export const metadata: Metadata = { title: "My homes", robots: { index: false }, alternates: { canonical: "/account/homes" } };

/** docs/05 Phase 3 task 8: claimed homes with value, 12 month change and "Thinking of selling". */
export default async function MyHomesPage() {
  const session = await auth();
  const ids = await claimedProperties(session!.user.id);
  const homes = (
    await Promise.all(
      ids.map(async (id) => {
        const p = await getPropertyDetail(id);
        return p ? { p, estimate: await getOrComputeEstimate(id) } : null;
      }),
    )
  ).filter((h) => h !== null);

  return (
    <div>
      <h1 className="mb-6 text-h1">My homes</h1>
      {!homes.length ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-6 py-12 text-center">
          <h2 className="text-h3">You have not claimed a home yet</h2>
          <p className="mt-1 text-body text-neutral-600">Look up your address to see its estimated value and track it here.</p>
          <Button asChild className="mt-5">
            <Link href="/home-value">Look up my home</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-10">
          {homes.map(({ p, estimate }) => {
            const slug = addressSlug(p.address.line1, p.address.line2, p.address.city);
            const street = [p.address.line2, p.address.line1].filter(Boolean).join(", ");
            const first = estimate.history[0]?.amount;
            const last = estimate.value?.amount;
            const change = first && last ? ((last - first) / first) * 100 : null;
            return (
              <li key={p.id} data-testid="owned-home" className="rounded-lg border border-neutral-200 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-h2">
                      <Link href={`/home-value/${p.id}/${slug}`} className="hover:underline">{street}, {p.address.city}</Link>
                    </h2>
                    {change !== null && (
                      <p className="mt-1 text-body text-neutral-700" data-testid="twelve-month-change">
                        Estimated change over 12 months: {change >= 0 ? "up" : "down"} {Math.abs(change).toFixed(1)}%
                        {first && last ? ` (${formatPrice(Math.abs(last - first))})` : ""}
                      </p>
                    )}
                  </div>
                  <SellLeadDialog propertyId={p.id} address={street} />
                </div>
                <div className="mt-5 grid gap-6 lg:grid-cols-[360px_1fr]">
                  <EstimateCard estimate={estimate} methodologyHref={`/home-value/${p.id}/${slug}`} agentOpinionHref={`/home-value/${p.id}/${slug}#sell`} />
                  <div>
                    <h3 className="mb-3 text-h3">Update your home&apos;s facts</h3>
                    <p className="mb-4 text-small text-neutral-600">Changes only affect your estimate. They do not change any listing.</p>
                    <OwnerFactsForm propertyId={p.id} initial={effectiveFacts(p)} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
