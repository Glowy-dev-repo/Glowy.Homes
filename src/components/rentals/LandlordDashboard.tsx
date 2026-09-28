"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDate, formatPrice } from "@/lib/format";
import type { RentalApplicationProfile } from "@/lib/listings/user-listing-schema";
import { cn } from "@/lib/utils";

const PUBLIC_STATUSES = new Set(["active", "sold", "leased"]);

type Listing = { id: string; listingType: string; status: string; price: number; address: string; createdAt: string; inquiries: number; applications: number; isFeatured: boolean };
type Inquiry = { id: string; leadType: string; consumerName: string; consumerEmail: string; consumerPhone: string | null; message: string | null; createdAt: string; address: string };
type Application = { id: string; status: string; createdAt: string; address: string; profile: RentalApplicationProfile; landlordNotes: string | null };

const STATUS_LABEL: Record<string, string> = { in_review: "In review", active: "Live", rejected: "Needs changes", pending: "Pending", sold: "Sold", leased: "Leased", withdrawn: "Withdrawn" };
const APP_STATUSES = ["submitted", "reviewing", "approved", "declined"] as const;

/** docs/01 R5: landlord dashboard with listings, inquiries and applications. Also used by FSBO sellers. */
export function LandlordDashboard({ listings, inquiries, applications }: { listings: Listing[]; inquiries: Inquiry[]; applications: Application[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"listings" | "inquiries" | "applications">("listings");
  const [message, setMessage] = useState<string | null>(null);

  const manage = async (id: string, status: string) => {
    const res = await fetch(`/api/listings/${id}/manage`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setMessage(res.ok ? "Listing updated." : "We could not update that listing.");
    router.refresh();
  };
  const review = async (id: string, status: string) => {
    const res = await fetch(`/api/rentals/submissions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setMessage(res.ok ? "Application updated." : "We could not update that application.");
    router.refresh();
  };

  const tabs = [
    ["listings", `Listings (${listings.length})`],
    ["inquiries", `Inquiries (${inquiries.length})`],
    ["applications", `Applications (${applications.length})`],
  ] as const;

  return (
    <div>
      <div role="tablist" aria-label="Dashboard" className="mb-6 flex gap-1 border-b border-neutral-200">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("min-h-11 px-4 font-medium", tab === k ? "border-b-2 border-accent text-accent" : "text-neutral-700")}>
            {label}
          </button>
        ))}
      </div>
      <p role="status" className="mb-3 text-small text-neutral-700">{message}</p>

      {tab === "listings" && (
        <ul className="space-y-3" data-testid="owner-listings">
          {listings.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 p-4" data-testid="owner-listing" data-status={l.status}>
              <div>
                {/* Listings waiting for review or rejected have no public page yet. */}
                {PUBLIC_STATUSES.has(l.status) ? (
                  <Link href={`/listing/${l.id}`} className="text-h3 hover:underline">{l.address}</Link>
                ) : (
                  <p className="text-h3">{l.address}</p>
                )}
                <p className="text-small text-neutral-600">
                  {STATUS_LABEL[l.status] ?? l.status} · {formatPrice(l.price, { listingType: l.listingType as "sale" | "rent" })} · {l.inquiries} inquiries{l.listingType === "rent" ? ` · ${l.applications} applications` : ""}
                </p>
              </div>
              {l.status === "active" && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => manage(l.id, l.listingType === "rent" ? "leased" : "sold")}>Mark {l.listingType === "rent" ? "leased" : "sold"}</Button>
                  <Button variant="ghost" onClick={() => manage(l.id, "withdrawn")}>Withdraw</Button>
                </div>
              )}
            </li>
          ))}
          {!listings.length && <li className="text-body text-neutral-600">No listings yet.</li>}
        </ul>
      )}

      {tab === "inquiries" && (
        <ul className="space-y-3">
          {inquiries.map((q) => (
            <li key={q.id} className="rounded-lg border border-neutral-200 p-4">
              <p className="text-h3">{q.consumerName}</p>
              <p className="text-small text-neutral-600">{q.address} · {formatDate(q.createdAt)}</p>
              <p className="mt-1 text-body">
                <a href={`mailto:${q.consumerEmail}`} className="text-accent hover:underline">{q.consumerEmail}</a>
                {q.consumerPhone ? ` · ${q.consumerPhone}` : ""}
              </p>
              {q.message && <p className="mt-1 text-body text-neutral-800">{q.message}</p>}
            </li>
          ))}
          {!inquiries.length && <li className="text-body text-neutral-600">No inquiries yet.</li>}
        </ul>
      )}

      {tab === "applications" && (
        <ul className="space-y-3" data-testid="landlord-applications">
          {applications.map((a) => (
            <li key={a.id} className="rounded-lg border border-neutral-200 p-4" data-testid="landlord-application">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-h3">{a.profile.fullName}</p>
                  <p className="text-small text-neutral-600">{a.address} · applied {formatDate(a.createdAt)}</p>
                </div>
                <label className="flex items-center gap-2 text-small">
                  Status
                  <select value={a.status} onChange={(e) => review(a.id, e.target.value)} className="h-11 rounded-md border border-neutral-300 bg-white px-2 text-base" aria-label={`Status for ${a.profile.fullName}`}>
                    {APP_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </label>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-small sm:grid-cols-3">
                <div><dt className="text-neutral-600">Move in</dt><dd>{formatDate(a.profile.moveInDate)}</dd></div>
                <div><dt className="text-neutral-600">Occupants</dt><dd>{a.profile.occupants}</dd></div>
                <div><dt className="text-neutral-600">Income</dt><dd>{formatPrice(a.profile.annualIncome)} a year</dd></div>
                <div><dt className="text-neutral-600">Employer</dt><dd>{a.profile.employer || "Not given"}</dd></div>
                <div><dt className="text-neutral-600">Pets</dt><dd>{a.profile.pets || "None"}</dd></div>
                <div><dt className="text-neutral-600">Contact</dt><dd>{a.profile.email}, {a.profile.phone}</dd></div>
              </dl>
            </li>
          ))}
          {!applications.length && <li className="text-body text-neutral-600">No applications yet.</li>}
        </ul>
      )}
    </div>
  );
}
