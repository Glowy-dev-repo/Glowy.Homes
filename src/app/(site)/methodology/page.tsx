import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/config/brand";
import { sqlClient } from "@/db";
import { formatNumber } from "@/lib/format";
import { ESTIMATE_DISCLAIMER } from "@/types/valuation";

export const metadata: Metadata = {
  title: "How our home value estimates work",
  description: `How ${brand.name} estimates home values from comparable sales, how we measure accuracy, and what the confidence levels mean.`,
  alternates: { canonical: "/methodology" },
};

export const revalidate = 86400;

type Row = { city: string; n: number; median: number; within5: number; within10: number };

async function accuracyByCity(): Promise<Row[]> {
  return sqlClient<Row[]>`
    select r.name as city, count(*)::int as n,
      percentile_cont(0.5) within group (order by a.abs_pct_error)::float8 as median,
      avg((a.abs_pct_error <= 0.05)::int)::float8 as within5,
      avg((a.abs_pct_error <= 0.10)::int)::float8 as within10
    from valuation_accuracy a join regions r on r.id = a.city_region_id
    where a.sold_date >= current_date - 365
    group by r.name order by r.name`;
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export default async function MethodologyPage() {
  const rows = await accuracyByCity();
  return (
    <article className="container-page max-w-3xl py-10 md:py-14">
      <h1 className="text-h1 md:text-display">How our estimates work</h1>
      <p className="mt-4 text-body text-neutral-700">
        Our estimate is an automated calculation from recent sales of similar homes nearby. It is designed to be transparent: every estimate lists the sales it used.
      </p>

      <h2 className="mt-10 text-h2">1. Finding comparable sales</h2>
      <p className="mt-2 text-body text-neutral-700">
        We look for sales of the same kind of home (for example, condos for a condo) within 5 km in the last 12 months. If fewer than five are found, we widen the search to 10 km and 18 months. With fewer than three, we do not show a number and say there is not enough data.
      </p>

      <h2 className="mt-8 text-h2">2. Adjusting each sale</h2>
      <p className="mt-2 text-body text-neutral-700">
        Each sale price is adjusted to the home being estimated: for interior size (larger homes are worth more, but not in direct proportion), for each bedroom and bathroom of difference, for the age of the building, and for how the local market has moved since the sale.
      </p>

      <h2 className="mt-8 text-h2">3. Weighting and the range</h2>
      <p className="mt-2 text-body text-neutral-700">
        Closer, more recent and more similar sales count more. The estimate is the weighted middle of the adjusted prices, which resists unusual sales. The range spans the middle of the adjusted prices and is never narrower than 4% either side.
      </p>

      <h2 className="mt-8 text-h2">4. Confidence</h2>
      <ul className="mt-2 list-disc space-y-1 pl-6 text-body text-neutral-700">
        <li><strong>High:</strong> at least eight similar sales within 3 km and a range narrower than 12% of the estimate.</li>
        <li><strong>Medium:</strong> at least five similar sales and a range narrower than 20%.</li>
        <li><strong>Low:</strong> everything else. In any city where our recent typical error is above 12%, we show Low until it improves.</li>
      </ul>

      <h2 className="mt-8 text-h2">5. Rent estimates</h2>
      <p className="mt-2 text-body text-neutral-700">
        Rent estimates use the same method with recent leases. With fewer than three leases nearby, we estimate rent from the home value and a typical gross yield, and label it Low confidence.
      </p>

      <h2 className="mt-10 text-h2">How accurate are we?</h2>
      <p className="mt-2 text-body text-neutral-700">
        For each sale, we compare the price to the estimate made 30 days before it sold, using only sales that happened before that date. These figures cover the last 12 months.
      </p>
      {rows.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-body" data-testid="accuracy-table">
            <caption className="sr-only">Estimate accuracy by city</caption>
            <thead>
              <tr className="border-b border-neutral-200 text-small text-neutral-600">
                <th scope="col" className="py-2 font-medium">City</th>
                <th scope="col" className="py-2 text-right font-medium">Sales checked</th>
                <th scope="col" className="py-2 text-right font-medium">Typical error</th>
                <th scope="col" className="py-2 text-right font-medium">Within 5%</th>
                <th scope="col" className="py-2 text-right font-medium">Within 10%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.city} className="border-b border-neutral-100">
                  <td className="py-2">{r.city}</td>
                  <td className="tabular py-2 text-right">{formatNumber(r.n)}</td>
                  <td className="tabular py-2 text-right">{pct(r.median)}</td>
                  <td className="tabular py-2 text-right">{pct(r.within5)}</td>
                  <td className="tabular py-2 text-right">{pct(r.within10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-small text-neutral-600">Typical error is the median absolute difference between estimate and sale price.</p>
        </div>
      ) : (
        <p className="mt-4 text-body text-neutral-600">Accuracy figures appear once enough sales have been checked.</p>
      )}

      <h2 className="mt-10 text-h2">Important</h2>
      <p className="mt-2 text-body text-neutral-700">{ESTIMATE_DISCLAIMER} It is not a valuation for lending or legal purposes. For a decision about buying or selling, talk to a licensed professional.</p>
      <p className="mt-6">
        <Link href="/home-value" className="inline-flex min-h-11 items-center font-medium text-accent hover:underline">Look up a home</Link>
      </p>
    </article>
  );
}
