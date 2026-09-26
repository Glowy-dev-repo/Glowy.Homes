import "server-only";
import { createHash, randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sqlClient } from "@/db";
import { sendEmail } from "@/lib/email";
import { getPropertyDetail } from "@/lib/properties/detail";
import { addressSlug } from "@/lib/slug";
import { refreshValuations } from "@/lib/valuation/engine";

// Owner loop (docs/01 V5, docs/05 Phase 3 tasks 6 and 7). Every function takes the user id from
// the session; ownership is checked against the database, never the request.

const sql = sqlClient;
const CODE_TTL_DAYS = 14;
const MAX_ATTEMPTS = 5;

/** Dev claims are instant; production asks for a code (mailed in the real product, see PROGRESS.md). */
export function claimMode(): "instant" | "code" {
  const v = process.env.CLAIM_VERIFICATION;
  if (v === "instant" || v === "code") return v;
  return process.env.NODE_ENV === "production" ? "code" : "instant";
}

const hashCode = (propertyId: string, code: string) =>
  createHash("sha256").update(`${process.env.AUTH_SECRET ?? "dev"}:${propertyId}:${code}`).digest("hex");

export type ClaimState = { claimedByMe: boolean; claimedByOther: boolean; pendingVerification: boolean; mode: "instant" | "code" };

export async function claimState(userId: string | null, propertyId: string): Promise<ClaimState> {
  const [row] = await sql<{ owner: string | null; pending: boolean }[]>`
    select p.owner_user_id as owner,
      exists (select 1 from property_claims c where c.property_id = p.id and c.user_id = ${userId}
        and c.verified_at is null and c.expires_at > now() and c.attempts < ${MAX_ATTEMPTS}) as pending
    from properties p where p.id = ${propertyId}`;
  return {
    claimedByMe: !!userId && row?.owner === userId,
    claimedByOther: !!row?.owner && row.owner !== userId,
    pendingVerification: !!userId && !!row?.pending,
    mode: claimMode(),
  };
}

async function setOwner(userId: string, propertyId: string) {
  await sql`
    update properties set owner_user_id = ${userId}, owner_claimed_at = now(), updated_at = now()
    where id = ${propertyId} and (owner_user_id is null or owner_user_id = ${userId})`;
}

export async function startClaim(userId: string, email: string, propertyId: string) {
  const p = await getPropertyDetail(propertyId);
  if (!p) return { status: "not_found" as const };
  if (p.ownerUserId === userId) return { status: "claimed" as const };
  if (p.ownerUserId) return { status: "taken" as const };

  if (claimMode() === "instant") {
    await setOwner(userId, propertyId);
    return { status: "claimed" as const };
  }

  const code = String(randomInt(100000, 1000000));
  await sql`
    insert into property_claims (property_id, user_id, code_hash, expires_at)
    values (${propertyId}, ${userId}, ${hashCode(propertyId, code)}, now() + ${`${CODE_TTL_DAYS} days`}::interval)`;
  // Production sends this code by post to the property address; until a mail vendor is wired it goes
  // through the email transport (logged in dev). Flagged in PROGRESS.md.
  const street = [p.address.line2, p.address.line1].filter(Boolean).join(", ");
  await sendEmail({
    to: email,
    subject: "Your home verification code",
    text: `Your verification code for ${street}, ${p.address.city} is ${code}. It expires in ${CODE_TTL_DAYS} days.`,
    html: `<p>Your verification code for ${street}, ${p.address.city} is <strong>${code}</strong>.</p><p>It expires in ${CODE_TTL_DAYS} days.</p>`,
    link: code,
  });
  return { status: "verification_required" as const };
}

export async function verifyClaim(userId: string, propertyId: string, code: string) {
  const [claim] = await sql<{ id: string; code_hash: string; attempts: number }[]>`
    select id, code_hash, attempts from property_claims
    where property_id = ${propertyId} and user_id = ${userId} and verified_at is null and expires_at > now()
    order by created_at desc limit 1`;
  if (!claim) return { status: "no_claim" as const };
  if (claim.attempts >= MAX_ATTEMPTS) return { status: "locked" as const };
  if (claim.code_hash !== hashCode(propertyId, code.trim())) {
    await sql`update property_claims set attempts = attempts + 1 where id = ${claim.id}`;
    return { status: "wrong_code" as const, attemptsLeft: MAX_ATTEMPTS - claim.attempts - 1 };
  }
  const [{ owner }] = await sql<{ owner: string | null }[]>`select owner_user_id as owner from properties where id = ${propertyId}`;
  if (owner && owner !== userId) return { status: "taken" as const };
  await sql`update property_claims set verified_at = now() where id = ${claim.id}`;
  await setOwner(userId, propertyId);
  return { status: "claimed" as const };
}

export const FactsPatch = z
  .object({
    beds: z.number().min(0).max(20).optional(),
    baths: z.number().min(0).max(20).optional(),
    sqft: z.number().int().min(150).max(30000).optional(),
    yearBuilt: z.number().int().min(1800).max(new Date().getFullYear() + 1).optional(),
    condition: z.enum(["needs_work", "average", "good", "excellent"]).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Change at least one fact.");

/** Owner fact override (docs/01 US5): merged over feed facts and revalued immediately. */
export async function updateFacts(userId: string, propertyId: string, patch: z.infer<typeof FactsPatch>) {
  const override: Record<string, unknown> = {};
  if (patch.beds !== undefined) override.beds = patch.beds;
  if (patch.baths !== undefined) override.baths = patch.baths;
  if (patch.sqft !== undefined) override.sqft = patch.sqft;
  if (patch.yearBuilt !== undefined) override.year_built = patch.yearBuilt;
  if (patch.condition !== undefined) override.condition = patch.condition;
  const updated = await sql<{ id: string; line1: string; line2: string | null; city: string }[]>`
    update properties set owner_facts_override = coalesce(owner_facts_override, '{}'::jsonb) || ${sql.json(override as never)}, updated_at = now()
    where id = ${propertyId} and owner_user_id = ${userId}
    returning id, address_line1 as line1, address_line2 as line2, city`;
  if (!updated.length) return { status: "forbidden" as const };
  await refreshValuations(sql, [propertyId]);
  revalidatePath(`/home-value/${propertyId}/${addressSlug(updated[0].line1, updated[0].line2, updated[0].city)}`);
  return { status: "ok" as const };
}
