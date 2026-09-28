import type { Metadata } from "next";
import { sqlClient } from "@/db";
import { formatDate, formatNumber } from "@/lib/format";
import { feedHealth, leadStats } from "@/server/data/admin";
import { market } from "@/config/market";
import { HideEstimateForm } from "@/components/admin/HideEstimateForm";
import { brokerConfigured } from "@/config/broker";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

function StatCard({ label, value, testId }: { label: string; value: string | number; testId?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4" data-testid={testId}>
      <p className="text-small text-neutral-600">{label}</p>
      <p className="tabular text-h1">{typeof value === "number" ? formatNumber(value) : value}</p>
    </div>
  );
}

export default async function AdminOverview() {
  const [feed, leads, [accuracy], [moderation]] = await Promise.all([
    feedHealth(),
    leadStats(),
    sqlClient<{ median: number | null; within10: number | null }[]>`
      select percentile_cont(0.5) within group (order by abs_pct_error)::float8 as median, avg((abs_pct_error <= 0.1)::int)::float8 as within10
      from valuation_accuracy where sold_date >= current_date - 365`,
    sqlClient<{ open: number; stale: number }[]>`
      select count(*)::int as open, count(*) filter (where created_at < now() - interval '24 hours')::int as stale from moderation_items where status = 'open'`,
  ]);

  return (
    <div className="space-y-10">
      <h1 className="text-h1">Operations</h1>

      {!brokerConfigured && (
        <p role="status" className="rounded-md border border-warning/40 bg-warning/10 p-4 text-body" data-testid="broker-missing">
          Broker details are not set. Before showing MLS listings, set BROKERAGE_NAME, BROKER_NAME, BROKER_DRE_LICENSE, BROKER_PHONE and BROKER_EMAIL so the site identifies the broker as the MLS requires.
        </p>
      )}

      {feed.signals.length > 0 && (
        <div role="alert" className="rounded-md border border-danger/40 bg-danger/5 p-4 text-body" data-testid="feed-alert">
          {feed.signals.map((s) => <p key={s}>{s}</p>)}
        </div>
      )}

      <section aria-labelledby="stats-h">
        <h2 id="stats-h" className="sr-only">Key numbers</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Active listings" value={feed.counts.active} testId="stat-active" />
          <StatCard label="Leads today" value={leads.totals.today} />
          <StatCard label="Unassigned leads" value={leads.unassigned.length} testId="stat-unassigned" />
          <StatCard label="Moderation queue" value={`${moderation.open}${moderation.stale ? ` (${moderation.stale} over 24h)` : ""}`} />
          <StatCard label="For sale" value={feed.counts.sale} />
          <StatCard label="For rent" value={feed.counts.rent} />
          <StatCard label="Leads, 30 days" value={leads.totals.month} />
          <StatCard label="Estimate typical error" value={accuracy.median !== null ? `${(accuracy.median * 100).toFixed(1)}%` : "None yet"} />
        </div>
      </section>

      <section aria-labelledby="feed-h">
        <h2 id="feed-h" className="mb-3 text-h2">Feed health</h2>
        <p className="mb-3 text-small text-neutral-600">Last successful run: {feed.lastSuccessAt ? formatDate(feed.lastSuccessAt) : "never"}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-body" data-testid="feed-runs">
            <caption className="sr-only">Recent feed runs</caption>
            <thead>
              <tr className="border-b border-neutral-200 text-small text-neutral-600">
                {["Started", "Source", "Status", "Fetched", "Created", "Updated", "Removed", "Errors"].map((h) => (
                  <th key={h} scope="col" className="py-2 pr-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {feed.runs.map((r) => (
                <tr key={r.id} className="border-b border-neutral-100">
                  <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.startedAt).toLocaleString(market.locale)}</td>
                  <td className="py-2 pr-3">{r.source}</td>
                  <td className="py-2 pr-3">{r.status}</td>
                  {(["fetched", "created", "updated", "removed", "errors"] as const).map((k) => (
                    <td key={k} className="tabular py-2 pr-3">{formatNumber(r.stats[k] ?? 0)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="leads-h">
        <h2 id="leads-h" className="mb-3 text-h2">Leads by city, last 30 days</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-body" data-testid="lead-stats">
            <caption className="sr-only">Lead volume and routing by city</caption>
            <thead>
              <tr className="border-b border-neutral-200 text-small text-neutral-600">
                {["City", "Leads", "Unassigned", "New", "Closed", "Median first reply"].map((h) => (
                  <th key={h} scope="col" className="py-2 pr-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.byCity.map((c) => (
                <tr key={c.city} className="border-b border-neutral-100">
                  <td className="py-2 pr-3">{c.city}</td>
                  <td className="tabular py-2 pr-3">{c.total}</td>
                  <td className="tabular py-2 pr-3">{c.unassigned}</td>
                  <td className="tabular py-2 pr-3">{c.newCount}</td>
                  <td className="tabular py-2 pr-3">{c.closed}</td>
                  <td className="tabular py-2 pr-3">{c.medianResponse === null ? "None yet" : `${c.medianResponse} min`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section aria-labelledby="estimate-h">
        <h2 id="estimate-h" className="mb-2 text-h2">Seller requests</h2>
        <p className="mb-3 max-w-2xl text-small text-neutral-600">When a listing broker tells the MLS that their seller does not want an automated estimate shown, hide it here (CSMAR Rule 12.16.15).</p>
        <HideEstimateForm />
      </section>
    </div>
  );
}
