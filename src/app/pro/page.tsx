import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "For agents and lenders",
  description: `Get buyer and seller leads in your area from ${brand.name}.`,
  alternates: { canonical: "/pro" },
};

export default function ProLandingPage() {
  return (
    <div className="container-page py-14 md:py-20">
      <h1 className="max-w-2xl text-h1 md:text-display">Meet buyers and sellers in your area</h1>
      <p className="mt-4 max-w-xl text-body text-neutral-600">
        {brand.name} connects agents and lenders with people who are actively searching in {brand.market.region}. Leads
        are routed by service area, with published rules and daily caps so every pro gets a fair share.
      </p>
      <Button asChild size="lg" className="mt-8">
        <Link href="/pro/join">Join as a pro</Link>
      </Button>
    </div>
  );
}
