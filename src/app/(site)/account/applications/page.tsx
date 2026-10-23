import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";
import { myApplication, mySubmissions } from "@/server/data/rentals";

export const metadata: Metadata = { title: "Rental applications", robots: { index: false }, alternates: { canonical: "/account/applications" } };

const STATUS: Record<string, string> = { submitted: "Sent", reviewing: "Being reviewed", approved: "Approved", declined: "Declined", withdrawn: "Withdrawn" };

export default async function ApplicationsPage() {
  const session = await auth();
  const [app, submissions] = await Promise.all([myApplication(session!.user.id), mySubmissions(session!.user.id)]);
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1">Rental applications</h1>
        <Button asChild variant="secondary"><Link href="/account/application">{app ? "Edit my application" : "Create my application"}</Link></Button>
      </div>
      {submissions.length ? (
        <ul className="space-y-3" data-testid="my-submissions">
          {submissions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 p-4" data-testid="my-submission">
              <div>
                <Link href={`/listing/${s.listingId}`} className="text-h3 hover:underline">{s.address}</Link>
                <p className="text-small text-neutral-600">{formatPrice(s.price, { listingType: "rent" })} · applied {formatDate(s.createdAt)}</p>
              </div>
              <span className="rounded-pill bg-neutral-100 px-3 py-1 text-small font-semibold" data-testid="submission-status">{STATUS[s.status] ?? s.status}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body text-neutral-600">You have not applied to any rentals yet. Use Apply on any rental listing.</p>
      )}
    </div>
  );
}
