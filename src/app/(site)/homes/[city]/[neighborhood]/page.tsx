import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrowsePage, browseTitle } from "@/components/search/BrowsePage";
import { browseSummary } from "@/lib/search/browse-copy";
import { findCity, findNeighborhood } from "@/lib/search/regions";

// Rendered on first request, then cached and revalidated daily.
export const revalidate = 86400;
export const dynamicParams = true;

type Props = { params: Promise<{ city: string; neighborhood: string }> };

export function generateStaticParams() {
  return [];
}

async function load(params: Props["params"]) {
  const { city: citySlug, neighborhood: slug } = await params;
  const city = await findCity(citySlug);
  const neighborhood = city ? await findNeighborhood(city.slug, slug) : null;
  return city && neighborhood ? { city, neighborhood } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await load(params);
  if (!found) return {};
  const { h1, place } = browseTitle({ type: "sale", ...found });
  return {
    title: h1,
    description: browseSummary(place, "sale", found.neighborhood.stats),
    alternates: { canonical: `/homes/${found.city.slug}/${found.neighborhood.slug}` },
  };
}

export default async function NeighborhoodHomesPage({ params }: Props) {
  const found = await load(params);
  if (!found) notFound();
  return <BrowsePage type="sale" {...found} />;
}
