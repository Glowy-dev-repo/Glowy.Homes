import "server-only";
import type { z } from "zod";
import { market } from "@/config/market";
import { sqlClient } from "@/db";
import type { ProProfileUpdate, ProSignup, ReviewInput } from "@/lib/pros/schema";
import { slugify } from "@/lib/slug";

const sql = sqlClient;

/**
 * Signup for partner agents and landlords. Agents start pending until an admin verifies the
 * license; landlords are active at once. The user gains the matching role. Agents choose the ZIP
 * codes they receive leads for, and optionally a price range and home types that suit them.
 */
export async function createPro(userId: string, input: z.infer<typeof ProSignup>) {
  const existing = await sql`select id from pros where user_id = ${userId}`;
  if (existing.length) return { status: "exists" as const };
  const role = input.proType;
  const status = input.proType === "landlord" ? "active" : "pending";
  return sql.begin(async (tx) => {
    const [pro] = await tx<{ id: string; slug: string }[]>`
      insert into pros (user_id, pro_type, slug, display_name, brokerage_name, license_number, license_region, phone, bio, languages,
        years_experience, price_min, price_max, specialties, status)
      values (${userId}, ${input.proType}, ${`${slugify(input.displayName)}-${Math.random().toString(36).slice(2, 7)}`}, ${input.displayName},
        ${input.brokerageName}, ${input.licenseNumber}, ${input.licenseNumber ? market.regionCode : null}, ${input.phone}, ${input.bio},
        ${tx.array(input.languages)}, ${input.yearsExperience ?? null}, ${input.priceMin ?? null}, ${input.priceMax ?? null},
        ${tx.array(input.homeTypes)}, ${status})
      returning id, slug`;
    if (input.zipCodes.length) {
      await tx`insert into pro_zip_codes ${tx(input.zipCodes.map((zip) => ({ pro_id: pro.id, zip })), "pro_id", "zip")} on conflict do nothing`;
    }
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
      price_min = case when ${input.priceMin !== undefined} then ${input.priceMin ?? null}::int else price_min end,
      price_max = case when ${input.priceMax !== undefined} then ${input.priceMax ?? null}::int else price_max end,
      specialties = coalesce(${input.homeTypes ? sql.array(input.homeTypes) : null}::text[], specialties),
      updated_at = now()
    where id = ${proId}`;
  if (input.zipCodes) {
    const zips = input.zipCodes;
    await sql.begin(async (tx) => {
      await tx`delete from pro_zip_codes where pro_id = ${proId} and zip <> all(${zips}::text[])`;
      if (zips.length) await tx`insert into pro_zip_codes ${tx(zips.map((zip) => ({ pro_id: proId, zip })), "pro_id", "zip")} on conflict do nothing`;
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
  /** ZIP codes the agent serves, with the city each belongs to. */
  zips: { zip: string; cityName: string | null; citySlug: string | null }[];
};

// City of a ZIP code: the city most of its homes are in.
const ZIP_CITY = `
  select distinct on (zip) zip, "cityName", "citySlug" from (
    select left(pp.postal_code, 5) as zip, c.name as "cityName", c.slug as "citySlug", count(*) as n
    from properties pp join regions c on c.id = pp.city_region_id where pp.postal_code ~ '^[0-9]{5}' group by 1, 2, 3
  ) t order by zip, n desc`;

export async function proBySlug(slug: string): Promise<ProPublic | null> {
  const [p] = await sql<ProPublic[]>`
    select p.id, p.slug, p.pro_type as "proType", p.display_name as "displayName", p.brokerage_name as "brokerageName",
      p.phone, p.bio, p.photo_url as "photoUrl", p.languages, p.years_experience as "yearsExperience",
      p.rating::float8 as rating, p.review_count as "reviewCount", p.license_verified_at is not null as "licenseVerified",
      coalesce((select json_agg(json_build_object('zip', z.zip, 'cityName', zc."cityName", 'citySlug', zc."citySlug") order by zc."cityName", z.zip)
        from pro_zip_codes z left join (${sql.unsafe(ZIP_CITY)}) zc on zc.zip = z.zip
        where z.pro_id = p.id), '[]'::json) as zips
    from pros p where p.slug = ${slug} and p.status = 'active'`;
  return p ?? null;
}

export async function proForEdit(userId: string) {
  const [p] = await sql<(ProPublic & { status: string; isAcceptingLeads: boolean; leadCapPerDay: number; licenseNumber: string | null; zipCodes: string[]; priceMin: number | null; priceMax: number | null; homeTypes: string[] })[]>`
    select p.id, p.slug, p.pro_type as "proType", p.display_name as "displayName", p.brokerage_name as "brokerageName", p.phone, p.bio,
      p.photo_url as "photoUrl", p.languages, p.years_experience as "yearsExperience", p.rating::float8 as rating, p.review_count as "reviewCount",
      p.license_verified_at is not null as "licenseVerified", p.status, p.is_accepting_leads as "isAcceptingLeads",
      p.lead_cap_per_day as "leadCapPerDay", p.license_number as "licenseNumber",
      coalesce(array(select zip from pro_zip_codes where pro_id = p.id order by zip), '{}') as "zipCodes", '[]'::json as zips,
      p.price_min as "priceMin", p.price_max as "priceMax", coalesce(p.specialties, '{}') as "homeTypes"
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

/** Find an agent page: active partner agents serving any ZIP code in the city. */
export async function agentsInCity(citySlug: string) {
  return sql<{ id: string; slug: string; displayName: string; brokerageName: string | null; photoUrl: string | null; rating: number | null; reviewCount: number; yearsExperience: number | null; responseTimeMinutes: number | null; languages: string[] }[]>`
    select distinct on (p.id) p.id, p.slug, p.display_name as "displayName", p.brokerage_name as "brokerageName", p.photo_url as "photoUrl",
      p.rating::float8 as rating, p.review_count as "reviewCount", p.years_experience as "yearsExperience",
      p.response_time_minutes as "responseTimeMinutes", p.languages
    from pros p
    join pro_zip_codes z on z.pro_id = p.id
    join (${sql.unsafe(ZIP_CITY)}) zc on zc.zip = z.zip
    where p.status = 'active' and p.pro_type = 'agent' and zc."citySlug" = ${citySlug}
    order by p.id`;
}
