import { ArrowRight, Building2, House, KeyRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RecentlyViewed } from "@/components/listing/RecentlyViewed";
import { HeroSearch } from "@/components/search/HeroSearch";
import { brand } from "@/config/brand";
import { formatNumber, formatPrice } from "@/lib/format";
import { allRegions } from "@/lib/search/regions";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// Static, refreshed hourly so city counts track region stats.
export const revalidate = 3600;

const ENTRY_POINTS = [
  {
    title: "Buy a home",
    body: "Search every home for sale on a map, save your favourites and get alerts when new ones appear.",
    href: "/search?type=sale",
    cta: "Browse homes",
    icon: House,
  },
  {
    title: "Rent a home",
    body: "Filter by pets, parking, laundry and move in date, then apply once for every rental you like.",
    href: "/search?type=rent",
    cta: "Find rentals",
    icon: KeyRound,
  },
  {
    title: "Sell your home",
    body: "See an estimate of what your home is worth, then list it yourself or talk to a local agent.",
    href: "/sell",
    cta: "Explore selling",
    icon: Building2,
  },
];

export default async function HomePage() {
  const regions = await allRegions();
  const cities = regions.filter((r) => r.type === "city");
  const statsFor = (slug: string) => cities.find((r) => r.slug === slug)?.stats ?? {};
  const forSale = cities.reduce((n, r) => n + Number(r.stats.listing_count ?? 0), 0);
  const forRent = cities.reduce((n, r) => n + Number(r.stats.rent_count ?? 0), 0);

  return (
    <>
      <section className="relative isolate overflow-hidden bg-neutral-950 text-white">
        {/* The glow: two soft radial lights, pure CSS so the hero costs no image download. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(60%_70%_at_80%_20%,rgba(245,158,11,0.22),transparent_70%),radial-gradient(45%_55%_at_10%_90%,rgba(161,98,7,0.20),transparent_70%)]"
        />
        <div className="container-page flex flex-col items-start gap-6 pb-16 pt-14 md:pb-24 md:pt-24">
          <p className="text-label uppercase tracking-[0.18em] text-neutral-300">{brand.market.region} real estate</p>
          <h1 className="max-w-3xl text-[40px] leading-[1.05] md:text-display lg:text-[64px]">{brand.tagline}</h1>
          <p className="max-w-xl text-[17px] leading-relaxed text-neutral-300">
            Homes for sale and for rent across {brand.market.region}, with a value estimate for every address.
          </p>
          <div className="w-full max-w-2xl rounded-lg bg-white p-3 text-neutral-900 shadow-raised md:p-4">
            <HeroSearch />
          </div>
          {forSale > 0 && (
            <ul className="flex flex-wrap gap-x-8 gap-y-2 pt-2 text-small text-neutral-300" aria-label="At a glance">
              <li>
                <span className="tabular font-semibold text-white">{formatNumber(forSale)}</span> homes for sale
              </li>
              <li>
                <span className="tabular font-semibold text-white">{formatNumber(forRent)}</span> rentals
              </li>
              <li>A value estimate for every address</li>
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="entry-heading" className="container-page py-14 md:py-20">
        <h2 id="entry-heading" className="text-h2 md:text-[32px]">
          Everything you need to move
        </h2>
        <ul className="mt-8 grid gap-5 md:grid-cols-3">
          {ENTRY_POINTS.map(({ title, body, href, cta, icon: Icon }) => (
            <li key={title}>
              <Link
                href={href}
                className="group flex h-full flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-7 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-raised"
              >
                <span className="grid size-12 place-items-center rounded-full bg-accent/10 text-accent">
                  <Icon className="size-6" aria-hidden />
                </span>
                <h3 className="text-h3 font-semibold">{title}</h3>
                <p className="flex-1 text-body text-neutral-600">{body}</p>
                <span className="inline-flex items-center gap-1.5 font-medium text-accent">
                  {cta}
                  <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
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

      <section aria-labelledby="value-heading" className="container-page py-14 md:py-20">
        <div className="relative isolate overflow-hidden rounded-lg bg-neutral-950 px-6 py-10 text-white md:px-12 md:py-14">
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(50%_80%_at_90%_50%,rgba(245,158,11,0.20),transparent_70%)]" />
          <h2 id="value-heading" className="max-w-xl text-h2 md:text-[32px]">
            What is your home worth?
          </h2>
          <p className="mt-3 max-w-xl text-body text-neutral-300">
            Get an estimate with a price range and a confidence level, built from recent sales nearby. It is an estimate, not an appraisal.
          </p>
          <Link
            href="/home-value"
            className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-md bg-white px-5 font-semibold text-neutral-950 transition-colors duration-150 hover:bg-neutral-100"
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
