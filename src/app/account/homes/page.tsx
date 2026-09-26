import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "My homes", robots: { index: false }, alternates: { canonical: "/account/homes" } };

export default function MyHomesPage() {
  return (
    <div>
      <h1 className="mb-6 text-h1">My homes</h1>
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-6 py-12 text-center">
        <h2 className="text-h3">You have not claimed a home yet</h2>
        <p className="mt-1 text-body text-neutral-600">Look up your address to see its estimated value and track it here.</p>
        <Button asChild className="mt-5">
          <Link href="/home-value">Look up my home</Link>
        </Button>
      </div>
    </div>
  );
}
