import { BellRing, MapPin, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Become a partner agent",
  description: `Receive buyer and seller inquiries for homes in the ZIP codes you serve, from people searching on ${brand.name}.`,
  alternates: { canonical: "/pro" },
};

const POINTS = [
  { icon: MapPin, title: "Leads by ZIP code", body: "Choose the ZIP codes you serve. Inquiries about homes in them can come to you." },
  { icon: Target, title: "Matched to what you do", body: "Set your price range and home types. When several agents cover a ZIP code, the best match gets the inquiry first." },
  { icon: BellRing, title: "Delivered right away", body: "You are notified the moment someone asks about a home. If you cannot respond in time, it moves to the next agent." },
];

export default function ProLandingPage() {
  return (
    <div className="container-page py-14 md:py-20">
      <h1 className="max-w-2xl text-h1 md:text-display">Get leads for homes in your ZIP codes</h1>
      <p className="mt-4 max-w-xl text-body text-neutral-600">
        {brand.name} connects real estate agents with people actively searching for homes in {brand.market.region}. When a visitor asks about a home or requests a tour, the inquiry goes to a partner agent who serves that home&apos;s ZIP code.
      </p>
      <Button asChild size="lg" className="mt-8">
        <Link href="/pro/join">Become a partner agent</Link>
      </Button>
      <ul className="mt-14 grid gap-5 md:grid-cols-3">
        {POINTS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="rounded-lg border border-neutral-200 bg-white p-6 shadow-card">
            <span className="grid size-11 place-items-center rounded-full bg-accent/10 text-accent">
              <Icon className="size-5" aria-hidden />
            </span>
            <h2 className="mt-4 text-h3 font-semibold">{title}</h2>
            <p className="mt-1 text-body text-neutral-600">{body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
