import { Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { brand } from "@/config/brand";
import { findCity } from "@/lib/search/regions";
import { agentsInCity } from "@/server/data/pros";

export const revalidate = 86400;

type Props = { params: Promise<{ city: string }>; searchParams?: Promise<{ type?: string }> };

export function generateStaticParams() {
  return brand.market.cities.map((c) => ({ city: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = await findCity((await params).city);
  if (!city) return {};
  return {
    title: `Real estate agents in ${city.name}`,
    description: `Find a local real estate agent in ${city.name}. Compare ratings, experience and languages, and contact an agent directly.`,
    alternates: { canonical: `/agents/${city.slug}` },
  };
}

/** docs/01 route /agents/[city]: find an agent. */
export default async function FindAgentPage({ params }: Props) {
  const city = await findCity((await params).city);
  if (!city) notFound();
  const agents = (await agentsInCity(city.slug)).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.reviewCount - a.reviewCount);
  return (
    <div className="container-page py-10">
      <h1 className="text-h1">Real estate agents in {city.name}</h1>
      <p className="mt-2 text-body text-neutral-700">{agents.length} agents serve {city.name} on {brand.name}.</p>
      <nav aria-label="Other cities" className="mt-4 flex flex-wrap gap-2">
        {brand.market.cities.filter((c) => c.slug !== city.slug).map((c) => (
          <Link key={c.slug} href={`/agents/${c.slug}`} className="inline-flex min-h-11 items-center rounded-pill border border-neutral-300 px-4 text-small hover:border-neutral-400">
            {c.name}
          </Link>
        ))}
      </nav>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="agent-list">
        {agents.map((a) => (
          <li key={a.id}>
            <Link href={`/agent/${a.slug}`} className="flex h-full gap-4 rounded-lg border border-neutral-200 p-5 shadow-card transition-shadow hover:shadow-raised">
              <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full bg-accent/10 text-h3 text-accent">
                {a.displayName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </span>
              <span className="min-w-0">
                <span className="block text-h3">{a.displayName}</span>
                <span className="block truncate text-small text-neutral-600">{a.brokerageName}</span>
                <span className="mt-1 flex items-center gap-1 text-small text-neutral-700">
                  <Star className="size-4 fill-warning text-warning" aria-hidden />
                  {a.rating ? `${a.rating.toFixed(1)} (${a.reviewCount})` : "No reviews yet"}
                  {a.yearsExperience ? ` · ${a.yearsExperience} yrs` : ""}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
