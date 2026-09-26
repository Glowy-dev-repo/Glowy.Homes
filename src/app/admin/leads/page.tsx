import type { Metadata } from "next";
import { ReassignForm } from "@/components/admin/ReassignForm";
import { formatDate } from "@/lib/format";
import { activeProsForRegion, leadStats, recentLeads } from "@/server/data/admin";

export const metadata: Metadata = { title: "Admin leads", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLeadsPage() {
  const [stats, recent] = await Promise.all([leadStats(), recentLeads(25)]);
  const rows = await Promise.all(
    [...stats.unassigned.map((l) => ({ ...l, status: "unassigned", proName: null as string | null })), ...recent.filter((r) => r.proId)].map(async (l) => ({ lead: l, pros: await activeProsForRegion(l.id) })),
  );
  return (
    <div className="space-y-8">
      <h1 className="text-h1">Leads</h1>
      <section aria-labelledby="unassigned-h">
        <h2 id="unassigned-h" className="mb-3 text-h2">Unassigned ({stats.unassigned.length})</h2>
        {!stats.unassigned.length && <p className="text-body text-neutral-600">Every lead is assigned.</p>}
      </section>
      <ul className="space-y-3" data-testid="admin-leads">
        {rows.map(({ lead, pros }) => (
          <li key={lead.id} data-lead-id={lead.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 p-4">
            <div>
              <p className="text-h3">{lead.consumerName}, {lead.leadType.replace(/_/g, " ")}</p>
              <p className="text-small text-neutral-600">
                {formatDate(lead.createdAt)} · {lead.region ?? "Unknown area"} · {lead.proName ? `with ${lead.proName}` : "unassigned"}
                {"reason" in lead && lead.reason ? ` · ${lead.reason}` : ""}
              </p>
            </div>
            <ReassignForm leadId={lead.id} pros={pros} />
          </li>
        ))}
      </ul>
    </div>
  );
}
