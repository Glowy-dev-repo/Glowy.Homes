import type postgres from "postgres";
import type { IdxClient } from "./client";
import { idxLeadToInput, type IdxLead } from "./leads";

type Sql = postgres.Sql;

export type IdxLeadSyncStats = { fetched: number; created: number; existing: number; skipped: number; enriched: number };

const CONSENT = {
  text: "Registered on the Glowy Homes listing search (IDX Broker) and agreed to its terms to receive listing updates and be contacted.",
  version: "idx-registration",
};

/** Saved homes for one IDX Broker lead; an empty list when they have none. */
async function savedHomes(client: IdxClient, idxLeadId: string): Promise<unknown> {
  return (await client.get(`/leads/property/${encodeURIComponent(idxLeadId)}`)) ?? [];
}

/**
 * Imports leads that registered on the IDX Broker search in the last `hours` hours (overlapping runs
 * are fine: each IDX lead is stored once, keyed by external_ref), then hands each new lead to routing.
 * Leads imported without a ZIP code (registered before saving or viewing a home) are looked at again
 * for a day, so routing retries can find their agent once they do.
 */
export async function syncIdxLeads(
  sql: Sql,
  client: IdxClient,
  opts: { hours?: number; onCreated?: (leadId: string) => Promise<void> } = {},
): Promise<IdxLeadSyncStats> {
  const stats: IdxLeadSyncStats = { fetched: 0, created: 0, existing: 0, skipped: 0, enriched: 0 };
  let next: string | null = `/leads/lead?interval=${opts.hours ?? 48}`;

  for (let page = 0; next && page < 50; page++) {
    const body = (await client.get(next)) as { data?: IdxLead[]; next?: string | null } | IdxLead[] | null;
    const leads = Array.isArray(body) ? body : (body?.data ?? []);
    next = Array.isArray(body) ? null : (body?.next ?? null);
    stats.fetched += leads.length;

    const refs = leads.map((l) => `idx:${l.id}`);
    const known = new Set(
      (await sql<{ ref: string }[]>`select external_ref as ref from leads where external_ref = any(${refs}::text[])`).map((r) => r.ref),
    );

    for (const lead of leads) {
      if (known.has(`idx:${lead.id}`)) {
        stats.existing++;
        continue;
      }
      const input = idxLeadToInput(lead, await savedHomes(client, String(lead.id)));
      if (!input) {
        stats.skipped++;
        continue;
      }
      const payload = {
        source: "idx_broker",
        idx_lead_id: input.idxLeadId,
        zip: input.zip,
        zip_source: input.zipSource,
        address: input.address,
        price: input.price,
        consent: { given_at: lead.subscribeDate ?? new Date().toISOString(), ...CONSENT },
      };
      const [row] = await sql<{ id: string }[]>`
        insert into leads (lead_type, consumer_name, consumer_email, consumer_phone, message, payload, source_page, status, external_ref)
        values ('contact', ${input.name}, ${input.email}, ${input.phone}, ${input.message}, ${sql.json(payload as never)}, 'idx', 'new', ${input.externalRef})
        on conflict (external_ref) where external_ref is not null do nothing
        returning id`;
      if (!row) {
        stats.existing++;
        continue;
      }
      stats.created++;
      await opts.onCreated?.(row.id);
    }
  }

  stats.enriched = await enrichMissingZips(sql, client);
  return stats;
}

/** Recent unassigned IDX leads without a ZIP code: check again whether they have saved a home since. */
async function enrichMissingZips(sql: Sql, client: IdxClient): Promise<number> {
  const pending = await sql<{ id: string; idxLeadId: string }[]>`
    select id, payload->>'idx_lead_id' as "idxLeadId" from leads
    where external_ref like 'idx:%' and coalesce(payload->>'zip', '') = '' and assigned_pro_id is null
      and status in ('new', 'unassigned') and created_at > now() - interval '24 hours'
    order by created_at desc limit 25`;
  let enriched = 0;
  for (const p of pending) {
    const lead = (await client.get(`/leads/lead/${encodeURIComponent(p.idxLeadId)}`)) as IdxLead | null;
    if (!lead) continue;
    const input = idxLeadToInput(lead, await savedHomes(client, p.idxLeadId));
    if (!input?.zip) continue;
    const patch = { zip: input.zip, zip_source: input.zipSource, address: input.address, price: input.price };
    await sql`
      update leads set payload = payload || ${sql.json(patch as never)}, message = ${input.message}, updated_at = now()
      where id = ${p.id}`;
    enriched++;
  }
  return enriched;
}
