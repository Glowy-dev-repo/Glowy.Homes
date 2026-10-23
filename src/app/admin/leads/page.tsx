import type { Metadata } from "next";
import { AdminFilters, AdminPager } from "@/components/admin/AdminList";
import { AdminHeader, Tabs } from "@/components/admin/AdminPage";
import { LeadCard } from "@/components/admin/LeadCard";
import { LEAD_STATUSES } from "@/db/schema/leads";
import { formatDate } from "@/lib/format";
import { activeProsForRegion } from "@/server/data/admin";
import { adminCounts, adminLeadCards, assignedLeadCount } from "@/server/data/admin-dashboard";
import { ADMIN_PAGE_SIZE, LeadFilters, adminLeads } from "@/server/data/admin-directory";

export const metadata: Metadata = { title: "Admin leads", robots: { index: false } };
export const dynamic = "force-dynamic";

const label = (s: string) => (s[0].toUpperCase() + s.slice(1)).replace(/_/g, " ");
type View = "waiting" | "assigned" | "all";

export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const raw = await searchParams;
  const filters = LeadFilters.parse(raw);
  const filtered = !!(filters.q || filters.zip || filters.status || filters.source);
  const view: View = raw.view === "assigned" || raw.view === "all" ? raw.view : filtered ? "all" : "waiting";
  const counts = await adminCounts();

  const tabs = (
    <Tabs
      items={[
        { href: "/admin/leads", label: "Waiting for an agent", active: view === "waiting", count: counts.waiting },
        { href: "/admin/leads?view=assigned", label: "Assigned", active: view === "assigned" },
        { href: "/admin/leads?view=all", label: "All leads", active: view === "all" },
      ]}
    />
  );

  if (view === "all") {
    const all = await adminLeads(filters);
    return (
      <div>
        <AdminHeader title="Leads" description="Every lead, newest first. Search by name or email, or filter by ZIP code, status and where it came from." />
        {tabs}
        <div className="space-y-4">
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
            hidden={{ view: "all" }}
          />
          {all.rows.length === 0 ? (
            <p className="rounded-lg border border-neutral-200 bg-white p-5 text-body text-neutral-600">No leads match these filters.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
              <table className="w-full min-w-[900px] text-left text-body" data-testid="all-leads">
                <caption className="sr-only">All leads</caption>
                <thead>
                  <tr className="border-b border-neutral-200 text-small text-neutral-600">
                    {["Received", "Person", "Request", "Home", "ZIP", "Came from", "Agent", "Status"].map((h) => (
                      <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {all.rows.map((l) => (
                    <tr key={l.id} className="border-b border-neutral-100 align-top last:border-0" data-testid="all-lead" data-all-lead-id={l.id}>
                      <td className="whitespace-nowrap px-3 py-2 text-small">{formatDate(l.createdAt)}</td>
                      <td className="px-3 py-2">
                        {l.consumerName}
                        <p className="text-small text-neutral-600">{l.consumerEmail}</p>
                      </td>
                      <td className="px-3 py-2">{label(l.leadType)}</td>
                      <td className="px-3 py-2 text-small">{l.address ?? "None"}</td>
                      <td className="tabular px-3 py-2">{l.zip ?? "Unknown"}</td>
                      <td className="px-3 py-2 text-small">{l.source === "idx" ? "IDX listing search" : "Our website"}</td>
                      <td className="px-3 py-2">{l.proName ?? <span className="text-neutral-600">Waiting</span>}</td>
                      <td className="px-3 py-2">{label(l.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <AdminPager
            base="/admin/leads"
            params={{ view: "all", q: filters.q, zip: filters.zip, status: filters.status, source: filters.source }}
            page={filters.page}
            total={all.total}
            pageSize={ADMIN_PAGE_SIZE}
          />
        </div>
      </div>
    );
  }

  // A link to one lead (from the "new lead to assign" email) shows that lead on its own.
  const leadId = raw.lead && /^[0-9a-f-]{36}$/i.test(raw.lead) ? raw.lead : undefined;
  const page = Math.min(500, Math.max(1, Number.parseInt(raw.page ?? "1", 10) || 1));
  const [leads, total] = await Promise.all([
    adminLeadCards(view, { leadId, limit: ADMIN_PAGE_SIZE, offset: (page - 1) * ADMIN_PAGE_SIZE }),
    leadId ? Promise.resolve(1) : view === "waiting" ? Promise.resolve(counts.waiting) : assignedLeadCount(),
  ]);
  const withPros = await Promise.all(leads.map(async (lead) => ({ lead, pros: await activeProsForRegion(lead.id) })));
  return (
    <div>
      <AdminHeader
        title="Leads"
        description={
          leadId
            ? "The lead from your email. Choose or change its agent here."
            : view === "waiting"
              ? "New leads come to Glowy Homes first. Choose the partner agent for each one, oldest first. The agent who covers the home's ZIP code is suggested, and the agent is emailed as soon as you assign."
              : "The latest leads that have an agent. You can still move a lead to another agent."
        }
      />
      {tabs}
      {withPros.length === 0 ? (
        <p className="rounded-lg border border-neutral-200 bg-white p-5 text-body text-neutral-600">
          {leadId ? "That lead was not found." : view === "waiting" ? "Every lead has an agent. New leads will show up here." : "No assigned leads yet."}
        </p>
      ) : (
        <ul className="space-y-3" data-testid="admin-leads">
          {withPros.map(({ lead, pros }) => (
            <LeadCard key={lead.id} lead={lead} pros={pros} />
          ))}
        </ul>
      )}
      {!leadId && total > ADMIN_PAGE_SIZE && (
        <div className="mt-5">
          <AdminPager base="/admin/leads" params={{ view: view === "assigned" ? "assigned" : undefined }} page={page} total={total} pageSize={ADMIN_PAGE_SIZE} />
        </div>
      )}
    </div>
  );
}
