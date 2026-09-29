import "server-only";
import { sqlClient } from "@/db";
import { inngest } from "@/inngest/client";
import { CONSENT_TEXT, CONSENT_TEXT_VERSION, type LeadInput } from "@/lib/leads/schema";

const sql = sqlClient;

/**
 * Creates a lead and announces lead.created for routing (docs/03 section 5). Region comes from the
 * listing or property. The event send is best effort: the unassigned sweep picks up anything missed.
 */
export async function createLead(input: LeadInput, consumerUserId: string | null): Promise<{ id: string }> {
  const payload: Record<string, unknown> = {
    consent: { given_at: new Date().toISOString(), text: CONSENT_TEXT, version: CONSENT_TEXT_VERSION },
  };
  if (input.tour) payload.tour = input.tour;
  if (input.proId) payload.requested_pro_id = input.proId;

  const [lead] = await sql<{ id: string }[]>`
    insert into leads (lead_type, consumer_user_id, consumer_name, consumer_email, consumer_phone, listing_id, property_id,
      region_id, message, payload, source_page, status)
    select ${input.leadType}, ${consumerUserId}, ${input.name}, ${input.email}, ${input.phone ?? null},
      ${input.listingId ?? null}, coalesce(${input.propertyId ?? null}::uuid, l.property_id),
      coalesce(l.neighborhood_region_id, l.city_region_id, p.neighborhood_region_id, p.city_region_id,
        null),
      ${input.message ?? null}, ${sql.json(payload as never)}, ${input.sourcePage ?? null}, 'new'
    from (select 1) one
    left join listings l on l.id = ${input.listingId ?? null}::uuid
    left join properties p on p.id = coalesce(${input.propertyId ?? null}::uuid, l.property_id)
    returning id`;

  // Never make the consumer wait on the job queue: the unassigned sweep catches any lead missed here.
  try {
    await Promise.race([
      inngest.send({ name: "lead/created", data: { leadId: lead.id } }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("queue timeout after 2s")), 2000)),
    ]);
  } catch (err) {
    console.warn(`[leads] could not queue routing for ${lead.id}: ${err instanceof Error ? err.message : String(err)}`);
  }
  return lead;
}

const LEADS_PER_EMAIL_PER_DAY = Number(process.env.LEADS_PER_EMAIL_PER_DAY ?? 10);

/**
 * Spam guards for the public lead form, checked before a lead is created. The same request repeated
 * within a day (same email, type, home and requested agent) returns the existing lead instead of
 * sending agents another one, and one email address can send at most LEADS_PER_EMAIL_PER_DAY leads.
 */
export async function leadGuard(input: LeadInput): Promise<{ duplicateOf: string } | { limited: true } | null> {
  const email = input.email.trim().toLowerCase();
  const [row] = await sql<{ duplicate: string | null; today: number }[]>`
    select
      (select id from leads
        where lower(consumer_email) = ${email} and lead_type = ${input.leadType}
          and listing_id is not distinct from ${input.listingId ?? null}::uuid
          and property_id is not distinct from coalesce(${input.propertyId ?? null}::uuid, (select property_id from listings where id = ${input.listingId ?? null}::uuid))
          and (payload->>'requested_pro_id') is not distinct from ${input.proId ?? null}
          and created_at > now() - interval '1 day'
        order by created_at desc limit 1) as duplicate,
      (select count(*)::int from leads where lower(consumer_email) = ${email} and created_at > now() - interval '1 day') as today`;
  if (row.duplicate) return { duplicateOf: row.duplicate };
  if (row.today >= LEADS_PER_EMAIL_PER_DAY) return { limited: true };
  return null;
}
