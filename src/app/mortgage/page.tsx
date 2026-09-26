import type { Metadata } from "next";
import Link from "next/link";
import { AffordabilityCalculator } from "@/components/mortgage/AffordabilityCalculator";
import { MonthlyCostCalculator } from "@/components/listing/MonthlyCostCalculator";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Mortgage calculators and rates",
  description: `Estimate what you can afford and your monthly payment, and compare typical rates from partner lenders on ${brand.name}.`,
  alternates: { canonical: "/mortgage" },
};

// docs/01 B3: static partner rate table in the MVP. Shown as typical rates, not offers.
const RATES =
  brand.market.country === "US"
    ? [
        { term: "30 year fixed", rate: "6.25%", lender: "Northstar Mortgage Group" },
        { term: "15 year fixed", rate: "5.60%", lender: "Northstar Mortgage Group" },
        { term: "7/1 adjustable (ARM)", rate: "5.95%", lender: "Northstar Mortgage Group" },
      ]
    : [
        { term: "5 year fixed", rate: "4.79%", lender: "Northstar Mortgage Group" },
        { term: "3 year fixed", rate: "4.94%", lender: "Northstar Mortgage Group" },
        { term: "5 year variable", rate: "5.10%", lender: "Northstar Mortgage Group" },
      ];

export default function MortgagePage() {
  return (
    <div className="container-page space-y-12 py-10">
      <div>
        <h1 className="text-h1 md:text-display">Mortgage calculators</h1>
        <p className="mt-2 max-w-xl text-body text-neutral-700">Estimate what you can afford and what it would cost each month. All results are estimates.</p>
      </div>
      <section aria-labelledby="afford-h">
        <h2 id="afford-h" className="mb-4 text-h2">How much can I afford?</h2>
        <AffordabilityCalculator />
      </section>
      <section aria-labelledby="monthly-h">
        <h2 id="monthly-h" className="mb-4 text-h2">Monthly cost</h2>
        <MonthlyCostCalculator price={800000} taxAnnual={null} hoaMonthly={null} />
      </section>
      <section aria-labelledby="rates-h">
        <h2 id="rates-h" className="mb-4 text-h2">Typical rates from partner lenders</h2>
        <table className="w-full max-w-xl text-left text-body">
          <caption className="sr-only">Typical partner lender rates</caption>
          <thead>
            <tr className="border-b border-neutral-200 text-small text-neutral-600">
              <th scope="col" className="py-2 font-medium">Term</th>
              <th scope="col" className="py-2 font-medium">Typical rate</th>
              <th scope="col" className="py-2 font-medium">Lender</th>
            </tr>
          </thead>
          <tbody>
            {RATES.map((r) => (
              <tr key={r.term} className="border-b border-neutral-100">
                <td className="py-2">{r.term}</td>
                <td className="tabular py-2">{r.rate}</td>
                <td className="py-2">{r.lender}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-small text-neutral-600">Rates are typical and subject to change. Your rate depends on your application.</p>
        <Button asChild className="mt-6">
          <Link href="/mortgage/preapproval">Get preapproved</Link>
        </Button>
      </section>
    </div>
  );
}
