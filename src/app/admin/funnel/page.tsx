import type { Metadata } from "next";
import { formatNumber } from "@/lib/format";
import { cityFunnel, eventCounts } from "@/server/data/funnel";

export const metadata: Metadata = { title: "Funnel", robots: { index: false }, alternates: { canonical: "/admin/funnel" } };
export const dynamic = "force-dynamic";

const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "0%");

export default async function FunnelPage() {
  const [rows, counts] = await Promise.all([cityFunnel(30), eventCounts(7)]);
  return (
    <div className="space-y-10">
      <section aria-labelledby="funnel-heading">
        <h1 id="funnel-heading" className="text-h1">Search to lead funnel</h1>
        <p className="mb-4 mt-1 text-body text-neutral-600">Last 30 days, by city. Each step counts visitors who also did the step before it, in order.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-body" data-testid="funnel-table">
            <caption className="sr-only">Funnel by city</caption>
            <thead>
              <tr className="border-b border-neutral-200 text-small text-neutral-600">
                <th scope="col" className="py-2 font-medium">City</th>
                <th scope="col" className="py-2 text-right font-medium">Searched</th>
                <th scope="col" className="py-2 text-right font-medium">Opened a listing</th>
                <th scope="col" className="py-2 text-right font-medium">Sent a lead</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.city} className="border-b border-neutral-100" data-city={r.city}>
                  <th scope="row" className="py-2 font-medium">{r.name}</th>
                  <td className="tabular py-2 text-right">{formatNumber(r.searchers)}</td>
                  <td className="tabular py-2 text-right">{formatNumber(r.viewers)} <span className="text-neutral-500">({pct(r.viewers, r.searchers)})</span></td>
                  <td className="tabular py-2 text-right">{formatNumber(r.leads)} <span className="text-neutral-500">({pct(r.leads, r.viewers)})</span></td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={4} className="py-6 text-neutral-600">No searches with a city in the last 30 days.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section aria-labelledby="events-heading">
        <h2 id="events-heading" className="text-h2">Events, last 7 days</h2>
        <dl className="mt-3 grid max-w-2xl grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          {counts.map((c) => (
            <div key={c.name} className="flex justify-between gap-3 border-b border-neutral-100 py-1">
              <dt className="text-neutral-700">{c.name.replace(/_/g, " ")}</dt>
              <dd className="tabular font-medium">{formatNumber(c.count)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
