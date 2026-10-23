import { Handshake, LineChart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AddressLookup } from "@/components/owner/AddressLookup";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Thinking of selling?",
  description: `See an estimated value for your home, then talk to a local ${brand.name} partner agent about selling.`,
  alternates: { canonical: "/sell" },
};

/** Sellers: an estimate first, then a conversation with a local partner agent. */
export default function SellPage() {
  return (
    <>
      <section className="border-b border-neutral-200 bg-neutral-50">
        <div className="container-page py-14 md:py-20">
          <h1 className="max-w-2xl text-h1 md:text-display">Thinking of selling?</h1>
          <p className="mt-3 max-w-xl text-body text-neutral-700">Start with an estimated value range for your home, then talk to a local agent about your options.</p>
          <div className="mt-8">
            <Suspense fallback={<AddressLookup />}>
              <AddressLookup prefillFromUrl />
            </Suspense>
          </div>
        </div>
      </section>
      <section className="container-page grid gap-4 py-12 md:grid-cols-2" aria-label="How it works">
        <div className="rounded-lg border border-neutral-200 p-6 shadow-card">
          <LineChart className="size-6 text-accent" aria-hidden />
          <h2 className="mt-3 text-h3">See what your home might be worth</h2>
          <p className="mt-1 text-body text-neutral-700">Look up your address for an estimated value range and the recent sales nearby it is based on. It is an estimate, not an appraisal.</p>
        </div>
        <div className="rounded-lg border border-neutral-200 p-6 shadow-card">
          <Handshake className="size-6 text-accent" aria-hidden />
          <h2 className="mt-3 text-h3">Talk to a local partner agent</h2>
          <p className="mt-1 text-body text-neutral-700">
            On your home&apos;s page, choose &quot;Talk to a local agent&quot;. A {brand.name} partner agent who serves your ZIP code will typically reach out within a day, with no obligation.
          </p>
          <Button asChild variant="secondary" className="mt-4">
            <Link href="/home-value">Look up my home</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
