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
  if (input.preapproval) payload.preapproval = input.preapproval;

  const [lead] = await sql<{ id: string }[]>`
    insert into leads (lead_type, consumer_user_id, consumer_name, consumer_email, consumer_phone, listing_id, property_id,
      region_id, message, payload, source_page, status)
    select ${input.leadType}, ${consumerUserId}, ${input.name}, ${input.email}, ${input.phone ?? null},
      ${input.listingId ?? null}, coalesce(${input.propertyId ?? null}::uuid, l.property_id),
      coalesce(l.neighborhood_region_id, l.city_region_id, p.neighborhood_region_id, p.city_region_id),
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
