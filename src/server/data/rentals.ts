import "server-only";
import { sqlClient } from "@/db";
import type { RentalApplicationProfile } from "@/lib/listings/user-listing-schema";
import { createLead } from "./leads";

// Reusable rental applications (docs/01 R4, R5). Applicant provided information only, no credit or
// background data (docs/06 section 1). Visible to the applicant and to landlords they applied to.

const sql = sqlClient;

export async function myApplication(userId: string) {
  const [a] = await sql<{ id: string; profile: RentalApplicationProfile; status: string; updatedAt: string }[]>`
    select id, profile, status, updated_at::text as "updatedAt" from rental_applications where applicant_user_id = ${userId}
    order by updated_at desc limit 1`;
  return a ?? null;
}

export async function saveApplication(userId: string, profile: RentalApplicationProfile) {
  const existing = await myApplication(userId);
  if (existing) {
    await sql`update rental_applications set profile = ${sql.json(profile as never)}, status = 'complete', updated_at = now() where id = ${existing.id}`;
    return existing.id;
  }
  const [row] = await sql<{ id: string }[]>`
    insert into rental_applications (applicant_user_id, profile, status) values (${userId}, ${sql.json(profile as never)}, 'complete') returning id`;
  return row.id;
}

export type SubmitResult = { status: "submitted"; submissionId: string } | { status: "not_found" | "not_rental" | "already" | "own_listing" };

/** Submits the renter's saved application to a rental listing and notifies its landlord. */
export async function submitApplication(userId: string, applicationId: string, listingId: string): Promise<SubmitResult> {
  const [app] = await sql<{ id: string; profile: RentalApplicationProfile }[]>`
    select id, profile from rental_applications where id = ${applicationId} and applicant_user_id = ${userId}`;
  if (!app) return { status: "not_found" };
  const [listing] = await sql<{ id: string; type: string; status: string; owner: string | null }[]>`
    select id, listing_type as type, status, owner_user_id as owner from listings where id = ${listingId}`;
  if (!listing) return { status: "not_found" };
  if (listing.type !== "rent" || listing.status !== "active") return { status: "not_rental" };
  if (listing.owner === userId) return { status: "own_listing" };
  const [dupe] = await sql`select id from rental_application_submissions where application_id = ${app.id} and listing_id = ${listingId}`;
  if (dupe) return { status: "already" };

  const lead = await createLead(
    {
      leadType: "rental_application",
      name: app.profile.fullName,
      email: app.profile.email,
      phone: app.profile.phone.replace(/[^\d+]/g, ""),
      listingId,
      message: `Rental application from ${app.profile.fullName}, moving in ${app.profile.moveInDate}.`,
      consent: true,
    },
    userId,
  );
  const [sub] = await sql<{ id: string }[]>`
    insert into rental_application_submissions (application_id, listing_id, lead_id, status)
    values (${app.id}, ${listingId}, ${lead.id}, 'submitted') returning id`;
  return { status: "submitted", submissionId: sub.id };
}

export async function mySubmissions(userId: string) {
  return sql<{ id: string; status: string; createdAt: string; listingId: string; address: string; price: number }[]>`
    select s.id, s.status, s.created_at::text as "createdAt", l.id as "listingId", l.price,
      concat_ws(', ', concat_ws(' ', p.address_line2, p.address_line1), p.city) as address
    from rental_application_submissions s
    join rental_applications a on a.id = s.application_id
    join listings l on l.id = s.listing_id join properties p on p.id = l.property_id
    where a.applicant_user_id = ${userId}
    order by s.created_at desc`;
}

/** Applications to the landlord's own listings, with the applicant's profile. */
export async function landlordSubmissions(userId: string) {
  return sql<{ id: string; status: string; createdAt: string; listingId: string; address: string; profile: RentalApplicationProfile; landlordNotes: string | null }[]>`
    select s.id, s.status, s.created_at::text as "createdAt", l.id as "listingId",
      concat_ws(', ', concat_ws(' ', p.address_line2, p.address_line1), p.city) as address,
      a.profile, s.landlord_notes as "landlordNotes"
    from rental_application_submissions s
    join rental_applications a on a.id = s.application_id
    join listings l on l.id = s.listing_id join properties p on p.id = l.property_id
    where l.owner_user_id = ${userId}
    order by s.created_at desc`;
}

export async function updateSubmission(userId: string, submissionId: string, patch: { status?: string; landlordNotes?: string }) {
  const rows = await sql`
    update rental_application_submissions s set
      status = coalesce(${patch.status ?? null}, s.status),
      landlord_notes = coalesce(${patch.landlordNotes ?? null}, s.landlord_notes)
    from listings l
    where s.id = ${submissionId} and l.id = s.listing_id and l.owner_user_id = ${userId}
    returning s.id, s.lead_id`;
  if (!rows.length) return false;
  // Any landlord action counts as a first response on the matching lead.
  await sql`update leads set first_response_at = coalesce(first_response_at, now()) where id = ${rows[0].lead_id}`;
  return true;
}

/** Inquiries (leads) on the landlord's listings. */
export async function landlordInquiries(userId: string) {
  return sql<{ id: string; leadType: string; status: string; consumerName: string; consumerEmail: string; consumerPhone: string | null; message: string | null; createdAt: string; address: string }[]>`
    select ld.id, ld.lead_type as "leadType", ld.status, ld.consumer_name as "consumerName", ld.consumer_email as "consumerEmail",
      ld.consumer_phone as "consumerPhone", ld.message, ld.created_at::text as "createdAt",
      concat_ws(', ', concat_ws(' ', p.address_line2, p.address_line1), p.city) as address
    from leads ld
    join listings l on l.id = ld.listing_id join properties p on p.id = l.property_id
    join pros pr on pr.id = ld.assigned_pro_id
    where l.owner_user_id = ${userId} and pr.user_id = ${userId}
    order by ld.created_at desc limit 100`;
}
