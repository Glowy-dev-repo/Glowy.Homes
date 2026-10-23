import type { Metadata } from "next";
import Link from "next/link";
import { AdminFilters, AdminPager } from "@/components/admin/AdminList";
import { formatDate } from "@/lib/format";
import { ADMIN_PAGE_SIZE, AgentFilters, adminAgents } from "@/server/data/admin-directory";

export const metadata: Metadata = { title: "Admin agents", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  // Dark text on a light tint: the label carries the meaning, the tint only helps scanning.
  active: "bg-success/15 text-neutral-900",
  pending: "bg-warning/15 text-neutral-900",
  suspended: "bg-danger/10 text-neutral-900",
};

export default async function AdminAgentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const filters = AgentFilters.parse(await searchParams);
  const { rows, total } = await adminAgents(filters);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1">Partner agents</h1>
        <p className="mt-1 text-small text-neutral-600">
          Every agent, their ZIP codes and how many leads they received. New sign ups are approved in Moderation.
        </p>
      </div>

      <AdminFilters
        action="/admin/agents"
        fields={[
          { kind: "text", name: "q", label: "Name, email or ZIP code", value: filters.q },
          {
            kind: "select",
            name: "status",
            label: "Status",
            value: filters.status,
            options: [
              { value: "active", label: "Active" },
              { value: "pending", label: "Waiting for approval" },
              { value: "suspended", label: "Suspended" },
            ],
          },
        ]}
      />

      {rows.length === 0 ? (
        <p className="text-body text-neutral-600">No agents match these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white px-4">
          <table className="w-full min-w-[860px] text-left text-body" data-testid="admin-agents">
            <caption className="sr-only">Partner agents</caption>
            <thead>
              <tr className="border-b border-neutral-200 text-small text-neutral-600">
                {["Agent", "Status", "ZIP codes", "Leads, 30 days", "Open leads", "Typical reply", "Joined"].map((h) => (
                  <th key={h} scope="col" className="py-2 pr-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-b border-neutral-100 align-top" data-testid="admin-agent">
                  <td className="py-3 pr-3">
                    <Link href={`/agent/${a.slug}`} className="font-medium text-accent underline-offset-2 hover:underline">{a.displayName}</Link>
                    <p className="text-small text-neutral-600">{a.email}</p>
                    {a.brokerageName && <p className="text-small text-neutral-600">{a.brokerageName}</p>}
                  </td>
                  <td className="py-3 pr-3">
                    <span className={`inline-block rounded px-2 py-0.5 text-small font-medium ${STATUS_STYLE[a.status] ?? ""}`}>
                      {a.status === "pending" ? "Waiting for approval" : a.status[0].toUpperCase() + a.status.slice(1)}
                    </span>
                    {!a.isAcceptingLeads && <p className="mt-1 text-small text-neutral-600">Paused leads</p>}
                  </td>
                  <td className="py-3 pr-3 text-small">
                    {a.zips.length ? (
                      <span className="flex flex-wrap gap-1">
                        {a.zips.map((z) => (
                          <Link key={z} href={`/admin/leads?zip=${z}`} className="rounded bg-neutral-100 px-1.5 py-0.5 tabular hover:bg-neutral-200">{z}</Link>
                        ))}
                      </span>
                    ) : (
                      <span className="text-neutral-600">None yet</span>
                    )}
                  </td>
                  <td className="tabular py-3 pr-3">{a.leads30}</td>
                  <td className="tabular py-3 pr-3">{a.open}</td>
                  <td className="tabular py-3 pr-3">{a.responseTimeMinutes === null ? "None yet" : `${a.responseTimeMinutes} min`}</td>
                  <td className="py-3 pr-3 whitespace-nowrap text-small">{formatDate(a.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminPager base="/admin/agents" params={{ q: filters.q, status: filters.status }} page={filters.page} total={total} pageSize={ADMIN_PAGE_SIZE} />
    </div>
  );
}
