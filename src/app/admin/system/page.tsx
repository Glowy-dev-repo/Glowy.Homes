import { CheckCircle2, CircleDashed } from "lucide-react";
import type { Metadata } from "next";
import { AdminHeader, Panel } from "@/components/admin/AdminPage";
import { HideEstimateForm } from "@/components/admin/HideEstimateForm";
import { market } from "@/config/market";
import { sqlClient } from "@/db";
import { formatDate, formatNumber } from "@/lib/format";
import { feedHealth } from "@/server/data/admin";
import { setupChecklist } from "@/server/data/admin-dashboard";

export const metadata: Metadata = { title: "Admin settings", robots: { index: false } };
export const dynamic = "force-dynamic";

const SOURCE: Record<string, string> = { synthetic: "Demo listings", simplyrets: "MLS (SimplyRETS)", reso: "MLS", crea_ddf: "MLS", csv: "File import" };
const STATUS: Record<string, string> = { success: "Worked", partial: "Worked, some errors", failed: "Failed", running: "Running" };

export default async function AdminSystemPage() {
  const setup = setupChecklist();
  const [feed, [accuracy]] = await Promise.all([
    feedHealth(),
    sqlClient<{ median: number | null }[]>`
      select percentile_cont(0.5) within group (order by abs_pct_error)::float8 as median
      from valuation_accuracy where sold_date >= current_date - 365`,
  ]);

  return (
    <div className="space-y-6">
      <AdminHeader title="Settings" description="Launch checklist, listing updates from the MLS, and seller requests." />

      <Panel title="Launch checklist" description="Read from the live site's settings. Each item is turned on in the hosting settings (Render), not here." testId="setup-checklist">
        <ul className="divide-y divide-neutral-100">
          {setup.map((s) => (
            <li key={s.label} className="flex items-start gap-3 py-3">
              {s.done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden /> : <CircleDashed className="mt-0.5 size-5 shrink-0 text-neutral-500" aria-hidden />}
              <div>
                <p className="font-medium">
                  {s.label} <span className="sr-only">{s.done ? "(done)" : "(not done)"}</span>
                </p>
                <p className="text-small text-neutral-600">{s.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Listing updates"
        description={`How the site keeps listings in step with the MLS. Last successful update: ${feed.lastSuccessAt ? formatDate(feed.lastSuccessAt) : "never"}.`}
      >
        {feed.signals.length > 0 && (
          <div role="alert" className="mb-4 rounded-md border border-danger/40 bg-danger/5 p-3 text-body" data-testid="feed-alert">
            {feed.signals.map((s) => <p key={s}>{s}</p>)}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-body" data-testid="feed-runs">
            <caption className="sr-only">Recent listing updates</caption>
            <thead>
              <tr className="border-b border-neutral-200 text-small text-neutral-600">
                {["When", "From", "Result", "Checked", "New", "Changed", "Taken off", "Problems"].map((h) => (
                  <th key={h} scope="col" className="py-2 pr-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {feed.runs.slice(0, 10).map((r) => (
                <tr key={r.id} className="border-b border-neutral-100">
                  <td className="whitespace-nowrap py-2 pr-3">{new Date(r.startedAt).toLocaleString(market.locale)}</td>
                  <td className="py-2 pr-3">{SOURCE[r.source] ?? r.source}</td>
                  <td className="py-2 pr-3">{STATUS[r.status] ?? r.status}</td>
                  {(["fetched", "created", "updated", "removed", "errors"] as const).map((k) => (
                    <td key={k} className="tabular py-2 pr-3">{formatNumber(r.stats[k] ?? 0)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-small text-neutral-600">
          Home value estimates are typically within {accuracy.median !== null ? `${(accuracy.median * 100).toFixed(1)}%` : "an unknown margin (no sales checked yet)"} of the final sale price.
        </p>
      </Panel>

      <Panel title="Seller requests" description="When a listing broker tells the MLS that their seller does not want an automated estimate shown, hide it here (CSMAR Rule 12.16.15).">
        <HideEstimateForm />
      </Panel>
    </div>
  );
}
