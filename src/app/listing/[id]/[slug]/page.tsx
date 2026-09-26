import { CalendarDays, MessageSquare, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { CommuteEstimator } from "@/components/listing/CommuteEstimator";
import { FactsGrid } from "@/components/listing/FactsGrid";
import { ListingCard } from "@/components/listing/ListingCard";
import { MonthlyCostCalculator } from "@/components/listing/MonthlyCostCalculator";
import { PhotoGallery } from "@/components/listing/PhotoGallery";
import { PriceHistoryTable } from "@/components/listing/PriceHistoryTable";
import { RecordView } from "@/components/listing/RecordView";
import { SaveButton } from "@/components/listing/saved-homes";
import { ShareButton } from "@/components/listing/ShareButton";
import { StatusBadge } from "@/components/listing/StatusBadge";
import { EstimateCard } from "@/components/valuation/EstimateCard";
import { brand } from "@/config/brand";
import { sqlClient } from "@/db";
import { formatArea, formatBaths, formatBeds, formatNumber, formatPrice } from "@/lib/format";
import { getListingDetail, type ListingDetail } from "@/lib/listings/detail";
import { daysOnMarket, factGroups, fullAddress, keyFacts, listingJsonLd, listingPath, metaDescription, toSummary } from "@/lib/listings/ldp";
import { similarListings } from "@/lib/listings/similar";
import { mediaUrl } from "@/lib/media/urls";
import { DEFAULT_RATE_PERCENT, monthlyCostRange } from "@/lib/mortgage";
import { getPropertyEstimate } from "@/lib/valuation/read";

// ISR: rendered on first request, cached, refreshed hourly and on listing change (docs/02 section 7).
export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string; slug: string }> };

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? `https://${brand.domain}`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await getListingDetail((await params).id);
  if (!l) return { title: "Listing not found" };
  const price = formatPrice(l.status === "sold" && l.soldPrice ? l.soldPrice : l.price, { listingType: l.listingType });
  return {
    title: `${fullAddress(l)} | ${price}`,
    description: metaDescription(l),
    alternates: { canonical: listingPath(l) },
    openGraph: { type: "website", title: `${fullAddress(l)} | ${price}`, description: metaDescription(l) },
  };
}

async function homesWithin1Km(l: ListingDetail): Promise<number> {
  const [{ n }] = await sqlClient<{ n: number }[]>`
    select count(*)::int as n from properties p
    where ST_DWithin(p.location, ST_SetSRID(ST_MakePoint(${l.lng}, ${l.lat}), 4326)::geography, 1000)`;
  return n;
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} id={id} className="scroll-mt-24 border-t border-neutral-200 py-8">
      <h2 id={`${id}-heading`} className="mb-4 text-h2">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function ListingPage({ params }: Props) {
  const { id, slug } = await params;
  const l = await getListingDetail(id);
  if (!l) notFound();
  const canonical = listingPath(l);
  if (!canonical.endsWith(`/${slug}`)) permanentRedirect(canonical);

  const [estimate, similar, density] = await Promise.all([getPropertyEstimate(l.propertyId), similarListings(l.id), homesWithin1Km(l)]);

  const sale = l.listingType === "sale";
  const closed = l.status === "sold" || l.status === "leased";
  const headlinePrice = closed && l.soldPrice ? l.soldPrice : l.price;
  const address = fullAddress(l);
  const dom = daysOnMarket(l);
  const facts = [formatBeds(l.beds), formatBaths(l.baths), formatArea(l.sqft)].filter(Boolean);
  const payment = sale
    ? monthlyCostRange({
        price: l.price,
        downPaymentPercent: 20,
        ratePercent: DEFAULT_RATE_PERCENT,
        amortizationYears: 25,
        propertyTaxAnnual: l.taxAnnual ?? l.price * 0.007,
        insuranceMonthly: 100,
        hoaMonthly: l.hoaFee ?? 0,
      })
    : null;
  const jsonLd = listingJsonLd(l, appUrl(), l.media.slice(0, 6).map((m) => `${appUrl()}${mediaUrl(m.storageKey, 1600)}`));
  const hoodStats = l.neighborhood?.stats ?? {};
  const sellHref = `/sell?property=${l.propertyId}`;

  return (
    <div className="pb-24 lg:pb-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <RecordView listing={toSummary(l)} />

      {/* 1. Photo gallery */}
      <div className="container-page px-0 pt-0 md:px-8 md:pt-6">
        <PhotoGallery media={l.media} address={address} virtualTourUrl={l.virtualTourUrl} />
      </div>

      <div className="container-page grid gap-x-10 lg:grid-cols-[62fr_38fr]">
        {/* 2 to 4. Price block, actions and estimate: first on mobile, a sticky sidebar on desktop */}
        <aside className="pt-6 lg:col-start-2 lg:row-span-[12] lg:row-start-1" aria-label="Price and actions">
          <div className="space-y-5 lg:sticky lg:top-24">
            <div>
              <StatusBadge status={l.status} listingType={l.listingType} className="border border-neutral-200 shadow-none" />
              <p className="tabular mt-3 text-display font-bold text-neutral-900" data-testid="ldp-price">
                {closed && <span className="mr-2 text-h3 font-medium text-neutral-600">{l.status === "sold" ? "Sold for" : "Leased for"}</span>}
                {formatPrice(headlinePrice, { listingType: l.listingType })}
              </p>
              <h1 className="mt-2 text-h3 font-medium text-neutral-900" data-testid="ldp-address">
                {address}
              </h1>
              <p className="mt-1 text-body text-neutral-700" data-testid="ldp-facts">
                {facts.join("  ·  ")}
              </p>
              <p className="mt-1 text-small text-neutral-600">
                {closed ? `${dom} days on market` : `${dom} ${dom === 1 ? "day" : "days"} on ${brand.name}`}
                {l.saveCount > 0 ? ` · ${formatNumber(l.saveCount)} saves` : ""}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <a href="#agent" className="col-span-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-accent px-4 font-semibold text-white hover:bg-accent-hover">
                <CalendarDays className="size-5" aria-hidden />
                Request a tour
              </a>
              <a href="#agent" className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-accent px-4 font-semibold text-accent hover:bg-accent/5">
                <MessageSquare className="size-5" aria-hidden />
                Contact agent
              </a>
              <SaveButton listingId={l.id} variant="button" />
              <ShareButton title={address} />
            </div>

            <EstimateCard
              estimate={estimate}
              payment={payment}
              methodologyHref={`/home-value/${l.propertyId}/${slug}`}
              agentOpinionHref={sellHref}
            />
          </div>
        </aside>

        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          {/* 5. Key facts */}
          <Section id="key-facts" title="Key facts">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              {keyFacts(l).map((f) => (
                <div key={f.label}>
                  <dt className="text-small text-neutral-600">{f.label}</dt>
                  <dd className="text-body font-medium text-neutral-900">{f.value}</dd>
                </div>
              ))}
            </dl>
          </Section>

          {/* 6. Description */}
          <Section id="description" title="About this home">
            <p className="max-w-prose whitespace-pre-line text-body text-neutral-800" data-testid="ldp-description">
              {l.description ?? "The listing brokerage has not provided a description."}
            </p>
          </Section>

          {/* 7. Full facts and features */}
          <Section id="facts" title="Facts and features">
            <FactsGrid groups={factGroups(l)} />
          </Section>

          {/* 8. Price history */}
          <Section id="price-history" title="Price history">
            <PriceHistoryTable events={l.priceHistory} listingType={l.listingType} />
          </Section>

          {/* 9. Tax history (if available in the feed) */}
          {l.taxAnnual ? (
            <Section id="tax-history" title="Tax history">
              <table className="w-full max-w-md text-left text-body">
                <caption className="sr-only">Annual property tax</caption>
                <thead>
                  <tr className="border-b border-neutral-200 text-small text-neutral-600">
                    <th scope="col" className="py-2 font-medium">Year</th>
                    <th scope="col" className="py-2 text-right font-medium">Property tax</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-2">{l.listDate.slice(0, 4)}</td>
                    <td className="tabular py-2 text-right">{formatPrice(l.taxAnnual)}</td>
                  </tr>
                </tbody>
              </table>
            </Section>
          ) : null}

          {/* 10. Monthly cost calculator */}
          {sale && !closed && (
            <Section id="monthly-cost" title="Monthly cost">
              <MonthlyCostCalculator price={l.price} taxAnnual={l.taxAnnual} hoaMonthly={l.hoaFee} />
            </Section>
          )}

          {/* 11. Neighbourhood */}
          <Section id="neighbourhood" title={l.neighborhood ? `Neighbourhood: ${l.neighborhood.name}` : "Neighbourhood"}>
            <div className="grid gap-6 md:grid-cols-2">
              <dl className="space-y-2 text-body">
                {hoodStats.median_price ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-neutral-600">Median list price</dt>
                    <dd className="tabular">{formatPrice(Number(hoodStats.median_price))}</dd>
                  </div>
                ) : null}
                {hoodStats.listing_count !== undefined ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-neutral-600">Homes for sale</dt>
                    <dd className="tabular">{formatNumber(Number(hoodStats.listing_count))}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <dt className="text-neutral-600">Homes within 1 km</dt>
                  <dd className="tabular">
                    {formatNumber(density)} ({density > 600 ? "dense, walkable area" : density > 200 ? "moderately dense" : "lower density"})
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-neutral-600">Nearby schools</dt>
                  <dd className="text-right text-neutral-700">School information is not available yet</dd>
                </div>
              </dl>
              {l.neighborhood && l.city && (
                <p className="md:col-start-1">
                  <Link href={`/homes/${l.city.slug}/${l.neighborhood.slug}`} className="inline-flex min-h-11 items-center font-medium text-accent hover:underline">
                    Homes for sale in {l.neighborhood.name}
                  </Link>
                </p>
              )}
              <div className="md:col-start-2 md:row-span-2 md:row-start-1">
                <CommuteEstimator from={[l.lng, l.lat]} />
              </div>
            </div>
          </Section>

          {/* 12. Similar homes */}
          <Section id="similar" title="Similar homes">
            {similar.length ? (
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="similar-homes">
                {similar.map((s) => (
                  <li key={s.id}>
                    <ListingCard listing={s} size="compact" action={<SaveButton listingId={s.id} />} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body text-neutral-600">No similar homes nearby right now.</p>
            )}
          </Section>

          {/* 13. Listing agent and brokerage attribution */}
          <Section id="agent" title="Listing agent">
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-neutral-200 p-5" data-testid="agent-card">
              <div aria-hidden className="grid size-14 place-items-center rounded-full bg-neutral-100 text-h3 text-neutral-700">
                {(l.agent?.displayName ?? l.brokerageName ?? brand.short).split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </div>
              <div className="min-w-0 flex-1">
                {l.agent ? (
                  <Link href={`/agent/${l.agent.slug}`} className="text-h3 hover:underline">
                    {l.agent.displayName}
                  </Link>
                ) : (
                  <p className="text-h3">{l.brokerageName ?? "Listing brokerage"}</p>
                )}
                <p className="text-small text-neutral-600">Listing courtesy of {l.brokerageName ?? "the listing brokerage"}</p>
              </div>
              {l.agent?.phone && (
                <a href={`tel:${l.agent.phone.replace(/\D/g, "")}`} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-neutral-300 px-4 font-medium">
                  <Phone className="size-4" aria-hidden />
                  Call {l.agent.phone}
                </a>
              )}
            </div>
            <p className="mt-3 text-small text-neutral-600">
              Information is provided by the listing brokerage and is deemed reliable but not guaranteed. {l.source === "synthetic" ? "This is demonstration data, not a real listing." : ""}
            </p>
          </Section>
        </div>
      </div>

      {/* 14. Sticky bottom bar on mobile */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-neutral-200 bg-white px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden">
        <p className="tabular mr-auto text-h3 font-bold">{formatPrice(headlinePrice, { listingType: l.listingType, compact: true })}</p>
        <a href="#agent" className="inline-flex min-h-11 items-center rounded-md border border-accent px-3 font-semibold text-accent">
          Contact
        </a>
        <a href="#agent" className="inline-flex min-h-11 items-center rounded-md bg-accent px-3 font-semibold text-white">
          Request tour
        </a>
      </div>
    </div>
  );
}
