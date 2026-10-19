import type { Metadata } from "next";
import { AdminFilters, AdminPager } from "@/components/admin/AdminList";
import { ReassignForm } from "@/components/admin/ReassignForm";
import { LEAD_STATUSES } from "@/db/schema/leads";
import { formatDate } from "@/lib/format";
import { activeProsForRegion, leadStats, recentLeads } from "@/server/data/admin";
import { ADMIN_PAGE_SIZE, LeadFilters, adminLeads } from "@/server/data/admin-directory";

export const metadata: Metadata = { title: "Admin leads", robots: { index: false } };
export const dynamic = "force-dynamic";

const label = (s: string) => (s[0].toUpperCase() + s.slice(1)).replace(/_/g, " ");

export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const filters = LeadFilters.parse(await searchParams);
  const [stats, recent, all] = await Promise.all([leadStats(), recentLeads(25), adminLeads(filters)]);
  const rows = await Promise.all(
    [...stats.unassigned.map((l) => ({ ...l, status: "unassigned", proName: null as string | null })), ...recent.filter((r) => r.proId)].map(async (l) => ({ lead: l, pros: await activeProsForRegion(l.id) })),
  );
  return (
    <div className="space-y-8">
      <h1 className="text-h1">Leads</h1>
      <section aria-labelledby="unassigned-h">
        <h2 id="unassigned-h" className="mb-1 text-h2">Waiting for an agent ({stats.unassigned.length})</h2>
        <p className="mb-3 max-w-2xl text-small text-neutral-600">
          New leads come to Glowy Homes first. Choose the partner agent for each one; the agent who covers the
          home&apos;s ZIP code is suggested. The agent is emailed as soon as you assign.
        </p>
        {!stats.unassigned.length && <p className="text-body text-neutral-600">Every lead has an agent.</p>}
      </section>
      <ul className="space-y-3" data-testid="admin-leads">
        {rows.map(({ lead, pros }) => {
          const suggested = "suggestedProId" in lead ? lead.suggestedProId : null;
          return (
            <li key={lead.id} data-lead-id={lead.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 p-4">
              <div>
                <p className="text-h3">{lead.consumerName}, {lead.leadType.replace(/_/g, " ")}</p>
                <p className="text-small text-neutral-600">
                  {formatDate(lead.createdAt)} · {lead.region ?? "Unknown area"} · {lead.proName ? `with ${lead.proName}` : "waiting for an agent"}
                </p>
                {!lead.proName && (
                  <p className="text-small text-neutral-800" data-testid="suggested-agent">
                    {"suggestedName" in lead && lead.suggestedName
                      ? `Suggested: ${lead.suggestedName}`
                      : "reason" in lead && lead.reason && !lead.reason.startsWith("waiting for Glowy Homes")
                        ? `No suggestion: ${lead.reason}`
                        : "No partner agent covers this ZIP code yet"}
                  </p>
                )}
              </div>
              <ReassignForm leadId={lead.id} pros={pros} suggestedId={suggested} assigned={!!lead.proName} />
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="all-h" className="space-y-4">
        <h2 id="all-h" className="text-h2">All leads</h2>
        <AdminFilters
          action="/admin/leads"
          fields={[
            { kind: "text", name: "q", label: "Name or email", value: filters.q },
            { kind: "text", name: "zip", label: "ZIP code", value: filters.zip, inputMode: "numeric" },
            { kind: "select", name: "status", label: "Status", value: filters.status, options: LEAD_STATUSES.map((s) => ({ value: s, label: label(s) })) },
            {
              kind: "select",
              name: "source",
              label: "Came from",
              value: filters.source,
              options: [
                { value: "site", label: "Our website" },
                { value: "idx", label: "IDX listing search" },
              ],
            },
          ]}
        />
        {all.rows.length === 0 ? (
          <p className="text-body text-neutral-600">No leads match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-body" data-testid="all-leads">
              <caption className="sr-only">All leads</caption>
              <thead>
                <tr className="border-b border-neutral-200 text-small text-neutral-600">
                  {["Received", "Person", "Request", "Home", "ZIP", "Came from", "Agent", "Status"].map((h) => (
                    <th key={h} scope="col" className="py-2 pr-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {all.rows.map((l) => (
                  <tr key={l.id} className="border-b border-neutral-100 align-top" data-testid="all-lead" data-all-lead-id={l.id}>
                    <td className="py-2 pr-3 whitespace-nowrap text-small">{formatDate(l.createdAt)}</td>
                    <td className="py-2 pr-3">
                      {l.consumerName}
                      <p className="text-small text-neutral-600">{l.consumerEmail}</p>
                    </td>
                    <td className="py-2 pr-3">{label(l.leadType)}</td>
                    <td className="py-2 pr-3 text-small">{l.address ?? "None"}</td>
                    <td className="tabular py-2 pr-3">{l.zip ?? "Unknown"}</td>
                    <td className="py-2 pr-3 text-small">{l.source === "idx" ? "IDX listing search" : "Our website"}</td>
                    <td className="py-2 pr-3">{l.proName ?? <span className="text-neutral-600">Unassigned</span>}</td>
                    <td className="py-2 pr-3">{label(l.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <AdminPager
          base="/admin/leads"
          params={{ q: filters.q, zip: filters.zip, status: filters.status, source: filters.source }}
          page={filters.page}
          total={all.total}
          pageSize={ADMIN_PAGE_SIZE}
        />
      </section>
    </div>
  );
}
