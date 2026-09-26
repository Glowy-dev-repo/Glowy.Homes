import { BadgeCheck, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadDialog } from "@/components/lead/LeadDialog";
import { ListingCard } from "@/components/listing/ListingCard";
import { sqlClient } from "@/db";
import { formatDate } from "@/lib/format";
import { coverJoin, summaryColumns } from "@/lib/search/postgres";
import type { ListingSummary } from "@/types/search";
import { approvedReviews, proBySlug } from "@/server/data/pros";

export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const pro = await proBySlug((await params).slug);
  if (!pro) return { title: "Profile not found" };
  const role = pro.proType === "lender" ? "Mortgage professional" : "Real estate agent";
  return {
    title: `${pro.displayName}, ${role}`,
    description: `${pro.displayName}${pro.brokerageName ? ` of ${pro.brokerageName}` : ""}. ${role} serving ${pro.areas.slice(0, 3).map((a) => a.name).join(", ")}.`,
    alternates: { canonical: `/agent/${pro.slug}` },
  };
}

const LANG: Record<string, string> = { en: "English", fr: "French", zh: "Chinese", pa: "Punjabi", es: "Spanish", ar: "Arabic", tl: "Tagalog" };

/** docs/01 P2: public profile with active and sold listings and reviews. */
export default async function AgentProfilePage({ params }: Props) {
  const pro = await proBySlug((await params).slug);
  if (!pro) notFound();
  const sql = sqlClient;
  const [active, sold, reviews] = await Promise.all([
    sql<ListingSummary[]>`
      select ${summaryColumns(sql)} from listings l join properties p on p.id = l.property_id ${coverJoin(sql)}
      where l.listing_agent_id = ${pro.id} and l.status = 'active' order by l.list_date desc limit 6`,
    sql<ListingSummary[]>`
      select ${summaryColumns(sql)} from listings l join properties p on p.id = l.property_id ${coverJoin(sql)}
      where l.listing_agent_id = ${pro.id} and l.status in ('sold', 'leased') order by l.sold_date desc nulls last limit 6`,
    approvedReviews(pro.id),
  ]);
  const role = pro.proType === "lender" ? "Mortgage professional" : "Real estate agent";

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-start gap-6">
        <div aria-hidden className="grid size-24 place-items-center rounded-full bg-accent/10 text-display text-accent">
          {pro.displayName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-h1">{pro.displayName}</h1>
          <p className="text-body text-neutral-700">
            {role}
            {pro.brokerageName ? `, ${pro.brokerageName}` : ""}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-3 text-small text-neutral-700">
            {pro.rating ? (
              <span className="inline-flex items-center gap-1">
                <Star className="size-4 fill-warning text-warning" aria-hidden />
                {pro.rating.toFixed(1)} from {pro.reviewCount} {pro.reviewCount === 1 ? "review" : "reviews"}
              </span>
            ) : (
              <span>No reviews yet</span>
            )}
            {pro.licenseVerified && (
              <span className="inline-flex items-center gap-1">
                <BadgeCheck className="size-4 text-success" aria-hidden />
                License verified
              </span>
            )}
            {pro.yearsExperience ? <span>{pro.yearsExperience} years of experience</span> : null}
          </p>
          <p className="mt-1 text-small text-neutral-600">Speaks {pro.languages.map((l) => LANG[l] ?? l).join(", ")}</p>
        </div>
        <LeadDialog
          leadType="contact"
          proId={pro.id}
          triggerClassName="inline-flex min-h-12 items-center rounded-md bg-accent px-5 font-semibold text-white hover:bg-accent-hover"
          trigger={`Contact ${pro.displayName.split(" ")[0]}`}
        />
      </div>

      {pro.bio && <p className="mt-6 max-w-prose whitespace-pre-line text-body text-neutral-800">{pro.bio}</p>}

      <section aria-labelledby="areas-h" className="mt-8">
        <h2 id="areas-h" className="text-h2">Areas served</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {pro.areas.map((a) => (
            <li key={a.slug}>
              <Link href={a.type === "city" ? `/homes/${a.slug}` : `/homes/${a.citySlug}/${a.slug}`} className="inline-flex min-h-11 items-center rounded-pill border border-neutral-300 px-4 text-small hover:border-neutral-400">
                {a.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {active.length > 0 && (
        <section aria-labelledby="active-h" className="mt-10">
          <h2 id="active-h" className="mb-4 text-h2">Active listings</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{active.map((l) => <li key={l.id}><ListingCard listing={l} size="compact" /></li>)}</ul>
        </section>
      )}
      {sold.length > 0 && (
        <section aria-labelledby="sold-h" className="mt-10">
          <h2 id="sold-h" className="mb-4 text-h2">Recently sold</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{sold.map((l) => <li key={l.id}><ListingCard listing={l} size="compact" /></li>)}</ul>
        </section>
      )}

      <section aria-labelledby="reviews-h" className="mt-10">
        <h2 id="reviews-h" className="mb-4 text-h2">Reviews</h2>
        {reviews.length ? (
          <ul className="space-y-4" data-testid="reviews">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-lg border border-neutral-200 p-4">
                <p className="flex items-center gap-2 text-small">
                  <span aria-label={`${r.rating} out of 5`} className="text-warning">{"★".repeat(r.rating)}<span className="text-neutral-300">{"★".repeat(5 - r.rating)}</span></span>
                  <span className="text-neutral-700">{r.author}, {formatDate(r.createdAt)}</span>
                  {r.verified && <span className="text-neutral-600">· Verified client</span>}
                </p>
                {r.body && <p className="mt-1 text-body">{r.body}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-neutral-600">No reviews yet.</p>
        )}
      </section>
    </div>
  );
}
