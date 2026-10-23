import type { Metadata } from "next";
import { ListingCard } from "@/components/listing/ListingCard";
import { sqlClient } from "@/db";
import { auth } from "@/lib/auth";
import { coverJoin, summaryColumns } from "@/lib/search/postgres";
import type { ListingSummary } from "@/types/search";

export const metadata: Metadata = { title: "Your listings", robots: { index: false }, alternates: { canonical: "/pro/listings" } };

export default async function ProListingsPage() {
  const session = await auth();
  const sql = sqlClient;
  const listings = await sql<ListingSummary[]>`
    select ${summaryColumns(sql)}
    from listings l join properties p on p.id = l.property_id join pros pr on pr.id = l.listing_agent_id
    ${coverJoin(sql)}
    where pr.user_id = ${session!.user.id}
    order by (l.status = 'active') desc, l.list_date desc limit 60`;
  return (
    <div className="container-page py-10">
      <h1 className="mb-6 text-h1">Your listings</h1>
      {listings.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <li key={l.id}>
              <ListingCard listing={l} size="compact" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body text-neutral-600">Listings from your brokerage feed where you are the listing agent appear here.</p>
      )}
    </div>
  );
}
