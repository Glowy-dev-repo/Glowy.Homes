import { ArrowRight, Building2, House, KeyRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { HeroSearch } from "@/components/search/HeroSearch";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

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

export default function HomePage() {
  return (
    <>
      <section className="border-b border-neutral-200 bg-neutral-50">
        <div className="container-page flex flex-col items-start gap-6 py-14 md:py-24">
          <h1 className="text-h1 md:text-display">{brand.tagline}</h1>
          <p className="max-w-xl text-body text-neutral-600">
            Homes for sale and for rent across {brand.market.region}, with a value estimate for every address.
          </p>
          <HeroSearch />
        </div>
      </section>

      <section aria-labelledby="entry-heading" className="container-page py-12">
        <h2 id="entry-heading" className="sr-only">
          Ways to get started
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {ENTRY_POINTS.map(({ title, body, href, cta, icon: Icon }) => (
            <li key={title}>
              <Link
                href={href}
                className="group flex h-full flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-6 shadow-card transition-shadow duration-200 hover:shadow-raised"
              >
                <Icon className="size-6 text-neutral-900" aria-hidden />
                <h3 className="text-h3">{title}</h3>
                <p className="flex-1 text-body text-neutral-600">{body}</p>
                <span className="inline-flex items-center gap-1 font-medium text-accent">
                  {cta}
                  <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="cities-heading" className="container-page pb-4">
        <h2 id="cities-heading" className="text-h2">
          Explore {brand.market.region}
        </h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {brand.market.cities.map((city) => (
            <li key={city.slug}>
              <Link
                href={`/homes/${city.slug}`}
                className="flex min-h-20 flex-col justify-center rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-card transition-shadow duration-200 hover:shadow-raised"
              >
                <span className="text-h3">{city.name}</span>
                <span className="text-small text-neutral-600">Homes for sale</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
