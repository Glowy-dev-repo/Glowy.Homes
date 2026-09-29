import { ArrowRight, MessageSquare, Search, UserRoundCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RecentlyViewed } from "@/components/listing/RecentlyViewed";
import { HeroSearch } from "@/components/search/HeroSearch";
import { brand } from "@/config/brand";
import { market } from "@/config/market";
import { formatNumber, formatPrice } from "@/lib/format";
import { allRegions } from "@/lib/search/regions";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// Static, refreshed hourly so city counts track region stats.
export const revalidate = 3600;

// How the site works, in the order a visitor meets it. The third step is what sets it apart.
const STEPS = [
  { icon: Search, title: "Search homes", body: "Every home for sale and for rent on a map, by city, neighborhood, address or ZIP code." },
  { icon: MessageSquare, title: "Ask about a home", body: "Request a tour or send a question from any listing, in a minute." },
  { icon: UserRoundCheck, title: "Your local agent replies", body: "A partner agent who serves that ZIP code, matched to the home's price and type." },
];

export default async function HomePage() {
  const regions = await allRegions();
  const cities = regions.filter((r) => r.type === "city");
  const statsFor = (slug: string) => cities.find((r) => r.slug === slug)?.stats ?? {};
  const forSale = cities.reduce((n, r) => n + Number(r.stats.listing_count ?? 0), 0);
  const forRent = cities.reduce((n, r) => n + Number(r.stats.rent_count ?? 0), 0);

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-neutral-200 bg-white">
        {/* Soft glow in the logo blue, pure CSS so the hero costs no image download. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(55%_65%_at_85%_10%,rgba(17,141,240,0.14),transparent_70%),radial-gradient(40%_50%_at_0%_100%,rgba(17,141,240,0.08),transparent_70%)]"
        />
        <div className="container-page grid items-center gap-10 pb-14 pt-10 md:pb-20 md:pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <div className="flex flex-col items-start gap-5">
            <p className="text-label uppercase tracking-[0.18em] text-accent">{brand.market.region} homes and local agents</p>
            <h1 className="max-w-2xl font-display text-[36px] leading-[1.08] text-navy md:text-[52px]">
              Find a home, and a local agent who knows your {market.postalLabel}.
            </h1>
            <p className="max-w-xl text-[17px] leading-relaxed text-neutral-700">
              Search homes for sale and for rent across {brand.market.region}. Ask about any home and your question goes to a {brand.name} partner agent who serves that {market.postalLabel}.
            </p>
            <div className="w-full max-w-2xl">
              <HeroSearch />
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <Link
                href="/agents"
                className="inline-flex min-h-12 items-center gap-2 rounded-md bg-navy px-5 font-semibold text-white transition-colors duration-150 hover:bg-navy/90"
              >
                <UserRoundCheck className="size-5" aria-hidden />
                Match me with a local agent
              </Link>
              <Link href="/search?type=rent" className="inline-flex min-h-11 items-center font-medium text-accent hover:underline">
                Search rentals
              </Link>
              <Link href="/home-value" className="inline-flex min-h-11 items-center font-medium text-accent hover:underline">
                What is my home worth?
              </Link>
            </div>
            {forSale > 0 && (
              <ul className="flex flex-wrap gap-x-8 gap-y-2 text-small text-neutral-600" aria-label="At a glance">
                <li>
                  <span className="tabular font-semibold text-neutral-900">{formatNumber(forSale)}</span> homes for sale
                </li>
                <li>
                  <span className="tabular font-semibold text-neutral-900">{formatNumber(forRent)}</span> rentals
                </li>
              </ul>
            )}
          </div>

          <section aria-labelledby="how-heading" className="rounded-lg border border-neutral-200 bg-white/90 p-6 shadow-raised md:p-8">
            <h2 id="how-heading" className="text-h2">
              How {brand.name} works
            </h2>
            <ol className="mt-6 space-y-6">
              {STEPS.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="flex gap-4">
                  <span className="relative grid size-12 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
                    <Icon className="size-6" aria-hidden />
                    <span aria-hidden className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-navy text-[12px] font-semibold text-white">
                      {i + 1}
                    </span>
                  </span>
                  <div>
                    <h3 className="text-h3 font-semibold">{title}</h3>
                    <p className="mt-1 text-body text-neutral-600">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </section>

      <section aria-labelledby="cities-heading" className="border-y border-neutral-200 bg-white">
        <div className="container-page py-14 md:py-20">
          <p className="text-label uppercase tracking-[0.18em] text-accent">Where to look</p>
          <h2 id="cities-heading" className="mt-2 text-h2 md:text-[32px]">
            Explore {brand.market.region}
          </h2>
          <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {brand.market.cities.map((city) => {
              const stats = statsFor(city.slug);
              return (
                <li key={city.slug}>
                  <Link
                    href={`/homes/${city.slug}`}
                    className="group flex min-h-28 flex-col justify-between rounded-lg border border-neutral-200 bg-neutral-50 p-5 transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-white hover:shadow-glow"
                  >
                    <span className="font-display text-[22px] font-semibold leading-tight">{city.name}</span>
                    <span className="mt-3 space-y-0.5">
                      <span className="block text-small text-neutral-600">
                        {stats.listing_count ? `${formatNumber(Number(stats.listing_count))} homes for sale` : "Homes for sale"}
                      </span>
                      {stats.median_price ? (
                        <span className="tabular block text-small font-medium text-neutral-800">Median {formatPrice(Number(stats.median_price), { compact: true })}</span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section aria-labelledby="agents-heading" className="container-page pt-14 md:pt-20">
        <div className="grid gap-6 rounded-lg border border-neutral-200 bg-neutral-50 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-10">
          <div>
            <h2 id="agents-heading" className="text-h2 md:text-[32px]">
              Are you a real estate agent?
            </h2>
            <p className="mt-2 max-w-2xl text-body text-neutral-700">
              Choose the {market.postalLabel}s you serve and receive questions and tour requests from buyers and renters looking at homes there.
            </p>
          </div>
          <Link
            href="/pro"
            className="inline-flex min-h-12 items-center gap-2 justify-self-start rounded-md border border-navy px-5 font-semibold text-navy transition-colors duration-150 hover:bg-navy hover:text-white"
          >
            Become a partner agent
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>

      <section aria-labelledby="value-heading" className="container-page py-14 md:py-20">
        <div className="relative isolate overflow-hidden rounded-lg bg-navy px-6 py-10 text-white md:px-12 md:py-14">
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(50%_80%_at_90%_50%,rgba(59,130,246,0.30),transparent_70%)]" />
          <h2 id="value-heading" className="max-w-xl text-h2 md:text-[32px]">
            What is your home worth?
          </h2>
          <p className="mt-3 max-w-xl text-body text-blue-100">
            Get an estimate with a price range and a confidence level, built from recent sales nearby. It is an estimate, not an appraisal.
          </p>
          <Link
            href="/home-value"
            className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-md bg-white px-5 font-semibold text-navy transition-colors duration-150 hover:bg-neutral-100"
          >
            Check a home value
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>

      <RecentlyViewed />
    </>
  );
}
