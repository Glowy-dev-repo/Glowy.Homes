import "server-only";
import type { z } from "zod";
import { market } from "@/config/market";
import { sqlClient } from "@/db";
import type { ProProfileUpdate, ProSignup, ReviewInput } from "@/lib/pros/schema";
import { slugify } from "@/lib/slug";

const sql = sqlClient;

/**
 * Pro signup (docs/01 P1). Agents and lenders start pending until an admin verifies the license
 * (docs/06 SOP 2); landlords are active at once. The user gains the matching role.
 */
export async function createPro(userId: string, input: z.infer<typeof ProSignup>) {
  const existing = await sql`select id from pros where user_id = ${userId}`;
  if (existing.length) return { status: "exists" as const };
  const role = input.proType;
  const status = input.proType === "landlord" ? "active" : "pending";
  return sql.begin(async (tx) => {
    const [pro] = await tx<{ id: string; slug: string }[]>`
      insert into pros (user_id, pro_type, slug, display_name, brokerage_name, license_number, license_region, phone, bio, languages, years_experience, status)
      values (${userId}, ${input.proType}, ${`${slugify(input.displayName)}-${Math.random().toString(36).slice(2, 7)}`}, ${input.displayName},
        ${input.brokerageName}, ${input.licenseNumber}, ${input.licenseNumber ? market.regionCode : null}, ${input.phone}, ${input.bio},
        ${tx.array(input.languages)}, ${input.yearsExperience ?? null}, ${status})
      returning id, slug`;
    await tx`
      insert into pro_service_areas (pro_id, region_id)
      select ${pro.id}, r.id from regions r where r.id = any(${input.serviceAreaIds}::uuid[]) and r.type in ('city', 'neighborhood')`;
    await tx`update users set roles = array(select distinct unnest(roles || ${tx.array([role])}::text[])) where id = ${userId}`;
    if (status === "pending") {
      await tx`insert into moderation_items (item_type, item_id, reason) values ('pro', ${pro.id}, 'new_submission')`;
    }
    return { status: "created" as const, proId: pro.id, slug: pro.slug, proStatus: status };
  });
}

export async function updatePro(proId: string, input: z.infer<typeof ProProfileUpdate>) {
  await sql`
    update pros set
      display_name = coalesce(${input.displayName ?? null}, display_name),
      brokerage_name = case when ${input.brokerageName !== undefined} then ${input.brokerageName ?? null} else brokerage_name end,
      phone = coalesce(${input.phone ?? null}, phone),
      bio = case when ${input.bio !== undefined} then ${input.bio ?? null} else bio end,
      languages = coalesce(${input.languages ? sql.array(input.languages) : null}::text[], languages),
      years_experience = coalesce(${input.yearsExperience ?? null}, years_experience),
      is_accepting_leads = coalesce(${input.isAcceptingLeads ?? null}, is_accepting_leads),
      lead_cap_per_day = coalesce(${input.leadCapPerDay ?? null}, lead_cap_per_day),
      updated_at = now()
    where id = ${proId}`;
  if (input.serviceAreaIds) {
    await sql.begin(async (tx) => {
      await tx`delete from pro_service_areas where pro_id = ${proId} and region_id <> all(${input.serviceAreaIds!}::uuid[])`;
      await tx`
        insert into pro_service_areas (pro_id, region_id)
        select ${proId}, r.id from regions r where r.id = any(${input.serviceAreaIds!}::uuid[]) and r.type in ('city', 'neighborhood')
        on conflict do nothing`;
    });
  }
}

export type ProPublic = {
  id: string;
  slug: string;
  proType: string;
  displayName: string;
  brokerageName: string | null;
  phone: string | null;
  bio: string | null;
  photoUrl: string | null;
  languages: string[];
  yearsExperience: number | null;
  rating: number | null;
  reviewCount: number;
  licenseVerified: boolean;
  areas: { name: string; slug: string; type: string; citySlug: string | null }[];
};

export async function proBySlug(slug: string): Promise<ProPublic | null> {
  const [p] = await sql<ProPublic[]>`
    select p.id, p.slug, p.pro_type as "proType", p.display_name as "displayName", p.brokerage_name as "brokerageName",
      p.phone, p.bio, p.photo_url as "photoUrl", p.languages, p.years_experience as "yearsExperience",
      p.rating::float8 as rating, p.review_count as "reviewCount", p.license_verified_at is not null as "licenseVerified",
      coalesce((select json_agg(json_build_object('name', r.name, 'slug', r.slug, 'type', r.type, 'citySlug', c.slug) order by r.name)
        from pro_service_areas a join regions r on r.id = a.region_id left join regions c on c.id = r.parent_id and r.type = 'neighborhood'
        where a.pro_id = p.id), '[]'::json) as areas
    from pros p where p.slug = ${slug} and p.status = 'active'`;
  return p ?? null;
}

export async function proForEdit(userId: string) {
  const [p] = await sql<(ProPublic & { status: string; isAcceptingLeads: boolean; leadCapPerDay: number; licenseNumber: string | null; areaIds: string[] })[]>`
    select p.id, p.slug, p.pro_type as "proType", p.display_name as "displayName", p.brokerage_name as "brokerageName", p.phone, p.bio,
      p.photo_url as "photoUrl", p.languages, p.years_experience as "yearsExperience", p.rating::float8 as rating, p.review_count as "reviewCount",
      p.license_verified_at is not null as "licenseVerified", p.status, p.is_accepting_leads as "isAcceptingLeads",
      p.lead_cap_per_day as "leadCapPerDay", p.license_number as "licenseNumber",
      coalesce(array(select region_id::text from pro_service_areas where pro_id = p.id), '{}') as "areaIds", '[]'::json as areas
    from pros p where p.user_id = ${userId}`;
  return p ?? null;
}

export async function approvedReviews(proId: string) {
  return sql<{ id: string; rating: number; body: string | null; author: string; createdAt: string; verified: boolean }[]>`
    select r.id, r.rating, r.body, coalesce(split_part(u.name, ' ', 1), 'Client') as author, r.created_at::text as "createdAt", r.lead_id is not null as verified
    from pro_reviews r join users u on u.id = r.author_user_id
    where r.pro_id = ${proId} and r.status = 'approved' order by r.created_at desc limit 20`;
}

/** docs/01 P8: reviews come from clients of a closed lead with that pro, and are moderated. */
export async function submitReview(userId: string, input: z.infer<typeof ReviewInput>) {
  const [lead] = await sql<{ proId: string | null; status: string; reviewed: boolean }[]>`
    select assigned_pro_id as "proId", status, exists (select 1 from pro_reviews r where r.lead_id = leads.id) as reviewed
    from leads where id = ${input.leadId} and consumer_user_id = ${userId}`;
  if (!lead) return { status: "not_found" as const };
  if (lead.status !== "closed" || !lead.proId) return { status: "not_closed" as const };
  if (lead.reviewed) return { status: "exists" as const };
  const [review] = await sql<{ id: string }[]>`
    insert into pro_reviews (pro_id, author_user_id, lead_id, rating, body, status)
    values (${lead.proId}, ${userId}, ${input.leadId}, ${input.rating}, ${input.body ?? null}, 'pending') returning id`;
  await sql`insert into moderation_items (item_type, item_id, reason) values ('review', ${review.id}, 'new_submission')`;
  return { status: "created" as const, reviewId: review.id };
}

/** docs/01 route /agents/[city]: active agents covering the city or its neighborhoods. */
export async function agentsInCity(citySlug: string, proType: "agent" | "lender" = "agent") {
  return sql<{ id: string; slug: string; displayName: string; brokerageName: string | null; photoUrl: string | null; rating: number | null; reviewCount: number; yearsExperience: number | null; responseTimeMinutes: number | null; languages: string[] }[]>`
    select distinct on (p.id) p.id, p.slug, p.display_name as "displayName", p.brokerage_name as "brokerageName", p.photo_url as "photoUrl",
      p.rating::float8 as rating, p.review_count as "reviewCount", p.years_experience as "yearsExperience",
      p.response_time_minutes as "responseTimeMinutes", p.languages
    from pros p
    join pro_service_areas a on a.pro_id = p.id
    join regions r on r.id = a.region_id
    left join regions c on c.id = r.parent_id
    where p.status = 'active' and p.pro_type = ${proType} and (r.slug = ${citySlug} and r.type = 'city' or c.slug = ${citySlug})
    order by p.id`;
}
