import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AddressLookup } from "@/components/owner/AddressLookup";
import { brand } from "@/config/brand";
import { ESTIMATE_DISCLAIMER } from "@/types/valuation";

export const metadata: Metadata = {
  title: "What is my home worth?",
  description: `Get a free estimated value range for any home in ${brand.market.region}, with the comparable sales behind it.`,
  alternates: { canonical: "/home-value" },
};

// Static (docs/01 route map); the address prefilled from the home page tab is read on the client.
export default function HomeValuePage() {
  return (
    <>
      <section className="border-b border-neutral-200 bg-neutral-50">
        <div className="container-page py-14 md:py-20">
          <h1 className="max-w-2xl text-h1 md:text-display">What is my home worth?</h1>
          <p className="mt-3 max-w-xl text-body text-neutral-700">
            See an estimated value range for any home in {brand.market.cities.map((c) => c.name).join(", ")}, with the recent nearby sales we used.
          </p>
          <div className="mt-8">
            <Suspense fallback={<AddressLookup />}>
              <AddressLookup prefillFromUrl />
            </Suspense>
          </div>
        </div>
      </section>
      <section className="container-page grid gap-6 py-12 md:grid-cols-3">
        {[
          ["A range, not a single number", "Every estimate comes with a low to high range and a confidence level, so you know how firm it is."],
          ["The sales behind it", "We show the comparable sales we used, adjusted for size, age and market changes."],
          ["Yours to refine", "Claim your home to correct its facts. The estimate updates right away."],
        ].map(([title, body]) => (
          <div key={title}>
            <h2 className="text-h3">{title}</h2>
            <p className="mt-1 text-body text-neutral-700">{body}</p>
          </div>
        ))}
      </section>
      <p className="container-page pb-4 text-small text-neutral-600">
        {ESTIMATE_DISCLAIMER} <Link href="/methodology" className="text-accent hover:underline">How estimates work</Link>
      </p>
    </>
  );
}
