import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrowsePage, browseTitle } from "@/components/search/BrowsePage";
import { brand } from "@/config/brand";
import { browseSummary } from "@/lib/search/browse-copy";
import { findCity } from "@/lib/search/regions";

export const revalidate = 86400;

type Props = { params: Promise<{ city: string }> };

export function generateStaticParams() {
  return brand.market.cities.map((c) => ({ city: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = await findCity((await params).city);
  if (!city) return {};
  const { h1 } = browseTitle({ type: "rent", city });
  return {
    title: h1,
    description: browseSummary(city.name, "rent", city.stats),
    alternates: { canonical: `/rentals/${city.slug}` },
  };
}

export default async function CityRentalsPage({ params }: Props) {
  const city = await findCity((await params).city);
  if (!city) notFound();
  return <BrowsePage type="rent" city={city} />;
}
