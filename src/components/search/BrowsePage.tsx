import Link from "next/link";
import { ListingCard } from "@/components/listing/ListingCard";
import { MlsDisclaimer } from "@/components/listing/MlsDisclaimer";
import { lastFeedUpdate } from "@/lib/ingestion/feed-status";
import { SaveButton } from "@/components/listing/saved-homes";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { formatNumber } from "@/lib/format";
import { browseSummary, quickLinks } from "@/lib/search/browse-copy";
import { searchListings } from "@/lib/search/postgres";
import { allRegions, regionOutline, type RegionRef } from "@/lib/search/regions";
import { toQueryString } from "@/lib/search/url";
import { MAX_PAGE, PAGE_SIZE, SearchParams } from "@/types/search";
import { MiniMap } from "./MiniMap";

type Props = { type: "sale" | "rent"; city: RegionRef; neighborhood?: RegionRef };

const center = (r: RegionRef) => (r.bbox ? [(r.bbox[0] + r.bbox[2]) / 2, (r.bbox[1] + r.bbox[3]) / 2] : [0, 0]);

export function browseTitle({ type, city, neighborhood }: Props) {
  const place = neighborhood ? `${neighborhood.name}, ${city.name}` : city.name;
  return { place, h1: type === "rent" ? `Rentals in ${place}` : `Homes for sale in ${place}` };
}

/**
 * City and neighborhood browse pages (docs/04 City browse page): the SEO engine. Server rendered
 * with ISR; every link is a plain anchor so crawlers can follow it.
 */
export async function BrowsePage(props: Props) {
  const { type, city, neighborhood } = props;
  const region = neighborhood ?? city;
  const { place, h1 } = browseTitle(props);
  const params = SearchParams.parse({ type, city: city.slug, neighborhood: neighborhood?.slug });
  const [result, rings, regions] = await Promise.all([searchListings(params), regionOutline(region.id), allRegions()]);

  const searchHref = (extra: Record<string, string> = {}) =>
    `/search?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(toQueryString(params))), ...extra })}`;
  const base = type === "rent" ? "/rentals" : "/homes";
  const pages = Math.ceil(result.total / PAGE_SIZE);
  const hoods = regions.filter((r) => r.type === "neighborhood" && r.parentSlug === city.slug && r.id !== neighborhood?.id);
  const [cx, cy] = center(city);
  const nearby = regions
    .filter((r) => r.type === "city" && r.id !== city.id)
    .map((r) => ({ r, d: Math.hypot(center(r)[0] - cx, center(r)[1] - cy) }))
    .sort((a, b) => a.d - b.d)
    .map(({ r }) => r);

  const crumbs = [
    { name: "Home", href: "/" },
    { name: city.name, href: `${base}/${city.slug}` },
    ...(neighborhood ? [{ name: neighborhood.name, href: `${base}/${city.slug}/${neighborhood.slug}` }] : []),
  ];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${brand.domain}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: `${appUrl}${c.href}` })),
  };

  return (
    <div className="container-page py-6 md:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="Breadcrumb" className="mb-3 text-small text-neutral-600">
        <ol className="flex flex-wrap items-center gap-1">
          {crumbs.map((c, i) => (
            <li key={c.href} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden>/</span>}
              {i < crumbs.length - 1 ? (
                <Link href={c.href} className="hover:underline">{c.name}</Link>
              ) : (
                <span aria-current="page" className="text-neutral-900">{c.name}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <h1 className="text-h1">{h1}</h1>
          <p className="mt-2 max-w-3xl text-body text-neutral-700" data-testid="browse-summary">
            {browseSummary(place, type, region.stats)}
          </p>
          {region.summary && (
            <section aria-labelledby="about-heading" className="mt-4 max-w-3xl">
              <h2 id="about-heading" className="text-h3">About {region.name}</h2>
              <p className="mt-1 text-body text-neutral-700" data-testid="region-summary">{region.summary}</p>
            </section>
          )}

          <ul
            className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
            aria-label="Popular searches"
          >
            {quickLinks(place, type).map((q) => (
              <li key={q.label} className="shrink-0">
                <Link
                  href={searchHref(q.query)}
                  className="inline-flex min-h-11 items-center whitespace-nowrap rounded-pill border border-neutral-300 px-4 text-small font-medium text-neutral-800 hover:border-neutral-400"
                >
                  {q.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center justify-between gap-3">
            <p className="text-small text-neutral-600" data-testid="browse-count">
              Showing {formatNumber(result.items.length)} of {formatNumber(result.total)}
            </p>
            <Button asChild variant="secondary">
              <Link href={searchHref()}>Open map search</Link>
            </Button>
          </div>

          <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {result.items.map((item, i) => (
              <li key={item.id}>
                <ListingCard listing={item} priority={i < 2} action={<SaveButton listingId={item.id} />} />
              </li>
            ))}
          </ul>

          {pages > 1 && (
            <nav aria-label="More results" className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <span className="px-2 text-body text-neutral-700">Page 1 of {formatNumber(Math.min(pages, MAX_PAGE))}</span>
              {Array.from({ length: Math.min(Math.min(pages, MAX_PAGE) - 1, 4) }, (_, i) => i + 2).map((p) => (
                <Link
                  key={p}
                  href={searchHref({ page: String(p) })}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-neutral-300 px-3 text-body hover:border-neutral-400"
                >
                  {p}
                </Link>
              ))}
              <Link href={searchHref({ page: "2" })} className="inline-flex min-h-11 items-center px-3 font-medium text-accent hover:underline">
                Next page
              </Link>
            </nav>
          )}

          <MlsDisclaimer className="mt-8" demo={brand.listingFeed === "synthetic"} updatedAt={await lastFeedUpdate()} />
        </div>

        <aside className="space-y-8">
          <MiniMap rings={rings} points={result.items} href={searchHref()} label={`Map of ${h1.toLowerCase()}`} />

          {hoods.length > 0 && (
            <nav aria-labelledby="hoods-heading">
              <h2 id="hoods-heading" className="text-h3">Neighborhoods in {city.name}</h2>
              <ul className="mt-2 grid grid-cols-2 gap-x-4">
                {hoods.map((h) => (
                  <li key={h.id}>
                    <Link
                      href={type === "rent" ? `/search?type=rent&city=${city.slug}&neighborhood=${h.slug}` : `/homes/${city.slug}/${h.slug}`}
                      className="inline-flex min-h-11 items-center text-small text-neutral-700 hover:text-neutral-900 hover:underline">
                      {h.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <nav aria-labelledby="nearby-heading">
            <h2 id="nearby-heading" className="text-h3">Nearby cities</h2>
            <ul className="mt-2">
              {nearby.map((c) => (
                <li key={c.id}>
                  <Link href={`${base}/${c.slug}`} className="inline-flex min-h-11 items-center text-small text-neutral-700 hover:text-neutral-900 hover:underline">
                    {type === "rent" ? `Rentals in ${c.name}` : `Homes for sale in ${c.name}`}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={type === "rent" ? `/homes/${city.slug}` : `/rentals/${city.slug}`}
                  className="inline-flex min-h-11 items-center text-small font-medium text-accent hover:underline"
                >
                  {type === "rent" ? `Homes for sale in ${city.name}` : `Rentals in ${city.name}`}
                </Link>
              </li>
            </ul>
          </nav>
        </aside>
      </div>
    </div>
  );
}
