import { Handshake, Home } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AddressLookup } from "@/components/owner/AddressLookup";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Sell your home",
  description: `See what your home might sell for, then choose to work with a local agent or list it yourself on ${brand.name}.`,
  alternates: { canonical: "/sell" },
};

/** docs/01 SE1: claim your home, then choose an agent or list it yourself. */
export default function SellPage() {
  return (
    <>
      <section className="border-b border-neutral-200 bg-neutral-50">
        <div className="container-page py-14 md:py-20">
          <h1 className="max-w-2xl text-h1 md:text-display">Sell your home with confidence</h1>
          <p className="mt-3 max-w-xl text-body text-neutral-700">Start with an estimated value range for your home, then choose how you want to sell.</p>
          <div className="mt-8">
            <Suspense fallback={<AddressLookup />}>
              <AddressLookup prefillFromUrl />
            </Suspense>
          </div>
        </div>
      </section>
      <section className="container-page grid gap-4 py-12 md:grid-cols-2" aria-label="Ways to sell">
        <div className="rounded-lg border border-neutral-200 p-6 shadow-card">
          <Handshake className="size-6" aria-hidden />
          <h2 className="mt-3 text-h3">Work with a local agent</h2>
          <p className="mt-1 text-body text-neutral-700">
            Look up your home and choose &quot;Talk to a local agent&quot;. An agent who covers your area will typically reach out within a day, with no obligation.
          </p>
          <Button asChild variant="secondary" className="mt-4">
            <Link href="/home-value">Look up my home</Link>
          </Button>
        </div>
        <div className="rounded-lg border border-neutral-200 p-6 shadow-card">
          <Home className="size-6" aria-hidden />
          <h2 className="mt-3 text-h3">List it yourself</h2>
          <p className="mt-1 text-body text-neutral-700">Create a for sale by owner listing with photos, price and your contact preferences. Listings are reviewed before they go live.</p>
          <Button asChild variant="secondary" className="mt-4">
            <Link href="/sell/list">Start a listing</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
