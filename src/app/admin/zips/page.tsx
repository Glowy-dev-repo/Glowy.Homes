import type { Metadata } from "next";
import Link from "next/link";
import { zipCoverage } from "@/server/data/admin-directory";

export const metadata: Metadata = { title: "Admin ZIP codes", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminZipsPage() {
  const rows = await zipCoverage();
  const gaps = rows.filter((r) => r.agents.length === 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1">ZIP code coverage</h1>
        <p className="mt-1 max-w-2xl text-small text-neutral-600">
          Which partner agents cover each ZIP code and how many leads it brought in over the last 30 days. ZIP codes
          with leads but no agent come first: those are the places to recruit an agent next.
        </p>
      </div>

      {gaps.length > 0 && (
        <p role="status" className="rounded-md border border-warning/40 bg-warning/10 p-4 text-body" data-testid="zip-gaps">
          {gaps.length} {gaps.length === 1 ? "ZIP code has" : "ZIP codes have"} leads but no partner agent:{" "}
          {gaps.slice(0, 12).map((g) => g.zip).join(", ")}
          {gaps.length > 12 ? " and more" : ""}.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-body text-neutral-600">No ZIP codes yet. They appear when an agent adds one or a lead comes in.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-body" data-testid="zip-coverage">
            <caption className="sr-only">ZIP code coverage</caption>
            <thead>
              <tr className="border-b border-neutral-200 text-small text-neutral-600">
                {["ZIP code", "Partner agents", "Leads, 30 days", "Unassigned, 30 days"].map((h) => (
                  <th key={h} scope="col" className="py-2 pr-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.zip} className="border-b border-neutral-100 align-top" data-testid="zip-row">
                  <td className="tabular py-2 pr-3 font-medium">
                    <Link href={`/admin/leads?zip=${r.zip}`} className="text-accent underline-offset-2 hover:underline">{r.zip}</Link>
                  </td>
                  <td className="py-2 pr-3">
                    {r.agents.length ? r.agents.join(", ") : <span className="font-medium text-danger">No agent</span>}
                  </td>
                  <td className="tabular py-2 pr-3">{r.leads30}</td>
                  <td className="tabular py-2 pr-3">{r.unassigned30}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
