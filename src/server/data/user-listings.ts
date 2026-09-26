import "server-only";
import { revalidatePath } from "next/cache";
import { brand } from "@/config/brand";
import { sqlClient } from "@/db";
import { sendEmail } from "@/lib/email";
import { inngest } from "@/inngest/client";
import { runListingChecks } from "@/lib/listings/moderation-checks";
import type { UserListingInput } from "@/lib/listings/user-listing-schema";
import { addressSlug } from "@/lib/slug";
import { getOrComputeEstimate } from "@/lib/valuation/read";

// FSBO and landlord listings (docs/01 SE2, R2; docs/03 section 7).

const sql = sqlClient;
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? `https://${brand.domain}`;
const today = () => new Date().toISOString().slice(0, 10);

/** Owners get a profile so inquiries on their listing route to them (docs/03 step 2). */
async function ensureOwnerPro(userId: string, kind: "landlord" | "owner", phone: string | null): Promise<string> {
  const [existing] = await sql<{ id: string }[]>`select id from pros where user_id = ${userId}`;
  if (existing) return existing.id;
  const [u] = await sql<{ name: string | null; email: string }[]>`select name, email from users where id = ${userId}`;
  const display = u.name || u.email.split("@")[0];
  const [pro] = await sql<{ id: string }[]>`
    insert into pros (user_id, pro_type, slug, display_name, phone, status, lead_cap_per_day)
    values (${userId}, ${kind}, ${`${kind}-${userId.slice(0, 8)}`}, ${display}, ${phone}, 'active', 100)
    returning id`;
  await sql`update users set roles = array(select distinct unnest(roles || ${sql.array([kind === "owner" ? "consumer" : "landlord"])}::text[])) where id = ${userId}`;
  return pro.id;
}

export type CreateResult =
  | { status: "created"; listingId: string; failedChecks: string[] }
  | { status: "not_found" | "claimed_by_other" };

export async function createUserListing(userId: string, input: UserListingInput): Promise<CreateResult> {
  const [property] = await sql<{ id: string; owner: string | null; hasLocation: boolean; line1: string; line2: string | null; city: string }[]>`
    select id, owner_user_id as owner, (location is not null and city_region_id is not null) as "hasLocation",
      address_line1 as line1, address_line2 as line2, city
    from properties where id = ${input.propertyId}`;
  if (!property) return { status: "not_found" };
  if (property.owner && property.owner !== userId) return { status: "claimed_by_other" };

  const phone = input.contact.phone ? input.contact.phone.replace(/[^\d+]/g, "") : null;
  const proKind = input.listingType === "rent" ? "landlord" : "owner";
  await ensureOwnerPro(userId, proKind, phone);

  // The owner knows their home: their facts fill the property record.
  await sql`
    update properties set owner_user_id = coalesce(owner_user_id, ${userId}), owner_claimed_at = coalesce(owner_claimed_at, now()),
      property_type = ${input.propertyType}, beds = ${input.beds}, baths = ${input.baths}, sqft = ${input.sqft},
      year_built = coalesce(${input.yearBuilt ?? null}, year_built), updated_at = now()
    where id = ${property.id}`;

  const estimate = await getOrComputeEstimate(property.id);
  const reference = input.listingType === "rent" ? estimate.rent?.amount : estimate.value?.amount;
  const checks = runListingChecks({
    photoCount: input.photos.length,
    price: input.price,
    estimate: reference ?? null,
    description: input.description,
    hasLocation: property.hasLocation,
  });

  const rentalTerms = input.rentalTerms
    ? {
        pets: input.rentalTerms.pets,
        furnished: input.rentalTerms.furnished,
        laundry: input.rentalTerms.laundry,
        parking: input.rentalTerms.parking,
        lease_min_months: input.rentalTerms.leaseMinMonths,
        deposit: input.rentalTerms.deposit,
        utilities_included: input.rentalTerms.utilitiesIncluded,
      }
    : null;

  const listingId = await sql.begin(async (tx) => {
    const [l] = await tx<{ id: string }[]>`
      insert into listings (property_id, listing_type, status, source, source_listing_id, source_updated_at, price, price_currency,
        original_price, list_date, status_date, available_date, description, features, rental_terms, owner_user_id, contact_prefs)
      values (${property.id}, ${input.listingType}, 'in_review', ${input.listingType === "rent" ? "landlord" : "fsbo"},
        ${`U${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`}, now(),
        ${input.price}, ${brand.currency}, ${input.price}, ${today()}, ${today()}, ${input.availableDate ?? null},
        ${input.description}, '{}'::jsonb, ${rentalTerms ? tx.json(rentalTerms) : null}, ${userId},
        ${tx.json({ preferred: input.contact.preferred, phone, showPhone: input.contact.showPhone })})
      returning id`;
    const mediaRows = input.photos.map((p, i) => ({
      listing_id: l.id,
      position: i,
      storage_key: p.storageKey ?? null,
      source_url: p.sourceUrl ?? null,
      blur_data_url: p.blurDataUrl ?? null,
      width: p.width ?? null,
      height: p.height ?? null,
      caption: p.caption ?? null,
      processed: !!p.storageKey,
    }));
    await tx.unsafe(
      `insert into listing_media (listing_id, kind, position, storage_key, source_url, blur_data_url, width, height, caption, processed_at)
       select x.listing_id, 'photo', x.position, x.storage_key, x.source_url, x.blur_data_url, x.width, x.height, x.caption,
         case when x.processed then now() end
       from jsonb_to_recordset($1::jsonb) as x(listing_id uuid, position int, storage_key text, source_url text, blur_data_url text,
         width int, height int, caption text, processed boolean)`,
      [tx.json(mediaRows)],
    );
    await tx`
      insert into moderation_items (item_type, item_id, reason, failed_checks)
      values ('listing', ${l.id}, 'new_submission', ${tx.json(checks.failed)})`;
    return l.id;
  });

  // Photos uploaded to R2 still need processing.
  const pending = await sql<{ id: string }[]>`select id from listing_media where listing_id = ${listingId} and processed_at is null`;
  if (pending.length) {
    await Promise.race([
      inngest.send(pending.map((m) => ({ name: "media/queued" as const, data: { mediaId: m.id } }))),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]).catch(() => {});
  }

  const [owner] = await sql<{ email: string }[]>`select email from users where id = ${userId}`;
  const street = [property.line2, property.line1].filter(Boolean).join(", ");
  await sendEmail({
    to: owner.email,
    subject: "Your listing is being reviewed",
    text: `Thanks for listing ${street}, ${property.city}. We review every listing, which typically takes less than a day. We will email you when it is live.`,
    html: `<p>Thanks for listing ${street}, ${property.city}.</p><p>We review every listing, which typically takes less than a day. We will email you when it is live.</p>`,
  }).catch(() => {});

  return { status: "created", listingId, failedChecks: checks.failed };
}

/** Admin decision on a user listing (docs/03 section 7). Rejection emails the reason. */
export async function applyUserListingDecision(listingId: string, decision: "approve" | "reject", note: string | null) {
  const [l] = await sql<{ id: string; propertyId: string; ownerEmail: string | null; price: number; line1: string; line2: string | null; city: string }[]>`
    update listings set
      status = ${decision === "approve" ? "active" : "rejected"},
      list_date = case when ${decision === "approve"} then current_date else list_date end,
      status_date = current_date, source_updated_at = now(), updated_at = now()
    where id = ${listingId} and status = 'in_review'
    returning id, property_id as "propertyId", price,
      (select email from users u where u.id = listings.owner_user_id) as "ownerEmail",
      (select address_line1 from properties p where p.id = listings.property_id) as line1,
      (select address_line2 from properties p where p.id = listings.property_id) as line2,
      (select city from properties p where p.id = listings.property_id) as city`;
  if (!l) return;
  const street = [l.line2, l.line1].filter(Boolean).join(", ");
  if (decision === "approve") {
    await sql`insert into listing_price_events (property_id, listing_id, event_type, price, event_date, source) values (${l.propertyId}, ${l.id}, 'listed', ${l.price}, current_date, 'user')`;
    revalidatePath("/homes/[city]", "page");
    revalidatePath("/rentals/[city]", "page");
    revalidatePath("/listing/[id]", "page");
    revalidatePath("/listing/[id]/[slug]", "page");
    const href = `${appUrl()}/listing/${l.id}/${addressSlug(l.line1, l.line2, l.city)}`;
    if (l.ownerEmail) {
      await sendEmail({ to: l.ownerEmail, subject: "Your listing is live", text: `${street}, ${l.city} is now live: ${href}`, html: `<p>${street}, ${l.city} is now live.</p><p><a href="${href}">View your listing</a></p>`, link: href }).catch(() => {});
    }
  } else if (l.ownerEmail) {
    await sendEmail({
      to: l.ownerEmail,
      subject: "Your listing needs changes",
      text: `We could not publish ${street}, ${l.city}. Reason: ${note ?? "see your dashboard"}. You can submit it again after making changes.`,
      html: `<p>We could not publish ${street}, ${l.city}.</p><p>Reason: ${(note ?? "see your dashboard").replace(/</g, "&lt;")}</p><p>You can submit it again after making changes.</p>`,
    }).catch(() => {});
  }
}

export async function ownerListings(userId: string) {
  return sql<{ id: string; listingType: string; status: string; price: number; address: string; createdAt: string; inquiries: number; applications: number; isFeatured: boolean }[]>`
    select l.id, l.listing_type as "listingType", l.status, l.price,
      concat_ws(', ', concat_ws(' ', p.address_line2, p.address_line1), p.city) as address,
      l.created_at::text as "createdAt", l.is_featured as "isFeatured",
      (select count(*)::int from leads ld where ld.listing_id = l.id) as inquiries,
      (select count(*)::int from rental_application_submissions s where s.listing_id = l.id) as applications
    from listings l join properties p on p.id = l.property_id
    where l.owner_user_id = ${userId}
    order by l.created_at desc`;
}

const OWNER_STATUSES = { sale: ["active", "pending", "sold", "withdrawn"], rent: ["active", "pending", "leased", "withdrawn"] } as const;

/** Owner updates their live listing's status or price; changes land in price history. */
export async function updateOwnerListing(userId: string, listingId: string, patch: { status?: string; price?: number }) {
  const [l] = await sql<{ type: "sale" | "rent"; status: string; price: number; propertyId: string }[]>`
    select listing_type as type, status, price, property_id as "propertyId" from listings where id = ${listingId} and owner_user_id = ${userId}`;
  if (!l) return "not_found" as const;
  if (["in_review", "rejected", "draft"].includes(l.status)) return "not_live" as const;
  if (patch.status && !(OWNER_STATUSES[l.type] as readonly string[]).includes(patch.status)) return "invalid" as const;
  await sql`
    update listings set status = coalesce(${patch.status ?? null}, status), price = coalesce(${patch.price ?? null}, price),
      sold_price = case when ${patch.status ?? null} in ('sold', 'leased') then coalesce(${patch.price ?? null}, price) else sold_price end,
      sold_date = case when ${patch.status ?? null} in ('sold', 'leased') then current_date else sold_date end,
      status_date = current_date, source_updated_at = now(), updated_at = now()
    where id = ${listingId}`;
  if (patch.status && patch.status !== l.status) {
    await sql`insert into listing_price_events (property_id, listing_id, event_type, price, event_date, source)
      values (${l.propertyId}, ${listingId}, ${patch.status === "active" ? "relisted" : patch.status}, ${patch.price ?? l.price}, current_date, 'user')`;
  } else if (patch.price && patch.price !== l.price) {
    await sql`insert into listing_price_events (property_id, listing_id, event_type, price, event_date, source)
      values (${l.propertyId}, ${listingId}, 'price_change', ${patch.price}, current_date, 'user')`;
  }
  return "ok" as const;
}
