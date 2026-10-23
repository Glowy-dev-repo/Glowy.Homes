import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ListingCard } from "@/components/listing/ListingCard";
import { SaveButton } from "@/components/listing/saved-homes";
import { ClaimPanel } from "@/components/owner/ClaimPanel";
import { SellLeadDialog } from "@/components/owner/SellLeadDialog";
import { CompsMap } from "@/components/valuation/CompsMap";
import { CompsTable } from "@/components/valuation/CompsTable";
import { EstimateCard } from "@/components/valuation/EstimateCard";
import { Track } from "@/components/layout/Track";
import { ValueHistoryChart } from "@/components/valuation/ValueHistoryChart";
import { sqlClient } from "@/db";
import { formatArea, formatDate, formatPrice, propertyTypeLabel } from "@/lib/format";
import { effectiveFacts, getPropertyDetail, nearbyForSale } from "@/lib/properties/detail";
import { addressSlug } from "@/lib/slug";
import { getOrComputeEstimate } from "@/lib/valuation/read";

// Property value page (docs/04): cached and refreshed hourly, and revalidated when an owner edits facts.
export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = await getPropertyDetail(id);
  if (!p) return { title: "Home not found" };
  const street = [p.address.line2, p.address.line1].filter(Boolean).join(", ");
  return {
    title: `${street}, ${p.address.city}: home value estimate`,
    description: `See the estimated value range, comparable sales and value history for ${street}, ${p.address.city}. Estimates are automated, not appraisals.`,
    alternates: { canonical: `/home-value/${p.id}/${addressSlug(p.address.line1, p.address.line2, p.address.city)}` },
  };
}

export default async function PropertyValuePage({ params }: Props) {
  const { id, slug } = await params;
  const p = await getPropertyDetail(id);
  if (!p) notFound();
  const canonical = addressSlug(p.address.line1, p.address.line2, p.address.city);
  if (slug !== canonical) permanentRedirect(`/home-value/${p.id}/${canonical}`);

  const [estimate, nearby] = await Promise.all([getOrComputeEstimate(p.id), nearbyForSale(p)]);
  const compIds = estimate.comps.slice(0, 5).map((c) => c.propertyId);
  const compPoints = compIds.length
    ? await sqlClient<{ id: string; lat: number; lng: number }[]>`
        select id, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng from properties where id = any(${compIds}::uuid[])`
    : [];
  const facts = effectiveFacts(p);
  const street = [p.address.line2, p.address.line1].filter(Boolean).join(", ");
  const address = `${street}, ${p.address.city}, ${p.address.regionCode} ${p.address.postalCode}`.trim();

  return (
    <div className="container-page py-8 md:py-12">
      <nav aria-label="Breadcrumb" className="mb-3 text-small text-neutral-600">
        <Link href="/home-value" className="hover:underline">Home value</Link>
        {p.city && (
          <>
            {" / "}
            <Link href={`/homes/${p.city.slug}`} className="hover:underline">{p.city.name}</Link>
          </>
        )}
      </nav>
      <h1 className="text-h1" data-testid="property-address">{address}</h1>
      <p className="mt-1 text-body text-neutral-700">
        {[propertyTypeLabel(p.propertyType), facts.beds !== null ? `${facts.beds} bd` : null, facts.baths !== null ? `${facts.baths} ba` : null, formatArea(facts.sqft)].filter(Boolean).join("  ·  ")}
      </p>
      {p.activeListingId && (
        <p className="mt-2">
          <Link href={`/listing/${p.activeListingId}/${canonical}`} className="inline-flex min-h-11 items-center font-medium text-accent hover:underline">
            This home is listed now. See the listing
          </Link>
        </p>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-10">
          <EstimateCard estimate={estimate} methodologyHref="/methodology" agentOpinionHref="#sell" size="large" />
          <Track name="estimate_view" props={{ propertyId: id, confidence: estimate.value?.confidence ?? "insufficient" }} />

          <section aria-labelledby="history-heading">
            <h2 id="history-heading" className="mb-3 text-h2">Value history</h2>
            {estimate.value ? <ValueHistoryChart points={estimate.history} /> : <p className="text-body text-neutral-600">No estimate history yet.</p>}
          </section>

          <section aria-labelledby="comps-heading">
            <h2 id="comps-heading" className="mb-3 text-h2">Comparable sales used</h2>
            <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
              <CompsTable comps={estimate.comps} />
              {compPoints.length > 0 && (
                <CompsMap
                  subject={{ lat: p.lat, lng: p.lng }}
                  comps={compIds.map((cid, i) => ({ ...compPoints.find((c) => c.id === cid)!, label: String(i + 1) })).filter((c) => c.lat !== undefined)}
                />
              )}
            </div>
            <p className="mt-3 text-small text-neutral-600">
              Sale prices are adjusted for size, bedrooms, bathrooms, age and market changes since each sale. <Link href="/methodology" className="text-accent hover:underline">How estimates work</Link>
            </p>
          </section>

          <section aria-labelledby="facts-heading">
            <h2 id="facts-heading" className="mb-3 text-h2">Home facts</h2>
            <dl className="grid max-w-xl grid-cols-2 gap-x-6 gap-y-3">
              {[
                ["Home type", propertyTypeLabel(p.propertyType)],
                ["Bedrooms", facts.beds ?? "Unknown"],
                ["Bathrooms", facts.baths ?? "Unknown"],
                ["Interior area", formatArea(facts.sqft) ?? "Unknown"],
                ["Year built", facts.yearBuilt ?? "Unknown"],
                ["Last sold", p.lastSoldPrice && p.lastSoldAt ? `${formatPrice(p.lastSoldPrice)} on ${formatDate(p.lastSoldAt)}` : "No recent sale on record"],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt className="text-small text-neutral-600">{label}</dt>
                  <dd className="text-body text-neutral-900">{String(value)}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <aside className="space-y-6">
          <ClaimPanel propertyId={p.id} />
          <section id="sell" aria-labelledby="sell-heading" className="rounded-lg border border-neutral-200 p-5">
            <h2 id="sell-heading" className="text-h3">Thinking of selling?</h2>
            <p className="mt-1 text-body text-neutral-700">Get an agent&apos;s opinion of value and a plan, with no obligation.</p>
            <div className="mt-3">
              <SellLeadDialog propertyId={p.id} address={street} trigger="Talk to a local agent" />
            </div>
          </section>
        </aside>
      </div>

      {nearby.length > 0 && (
        <section aria-labelledby="nearby-heading" className="mt-12">
          <h2 id="nearby-heading" className="mb-4 text-h2">Homes for sale nearby</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nearby.map((l) => (
              <li key={l.id}>
                <ListingCard listing={l} size="compact" action={<SaveButton listingId={l.id} />} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
