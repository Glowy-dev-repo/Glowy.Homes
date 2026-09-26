import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/layout/Prose";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "About",
  description: `${brand.name} helps you search homes for sale and for rent, estimate what a home is worth, and connect with local professionals.`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <Prose title={`About ${brand.name}`}>
      <p>{brand.name} is a home search site for {brand.market.region}. You can search homes for sale and for rent on a map, see what a home is likely worth, save homes and searches, and reach a local agent, lender or landlord when you are ready.</p>
      <h2>What we believe</h2>
      <ul>
        <li>Estimates should be honest. Every estimate shows a range and a confidence level, and our <Link href="/methodology" className="text-accent hover:underline">methodology page</Link> publishes how accurate we are.</li>
        <li>Your contact details go only to the professional you asked to hear from.</li>
        <li>Homes are for everyone. Listings on {brand.name} may not exclude people on protected grounds, and we review every listing posted by owners and landlords.</li>
      </ul>
      <h2>Contact</h2>
      <p>Questions or corrections: <a href={`mailto:${brand.supportEmail}`} className="text-accent hover:underline">{brand.supportEmail}</a>.</p>
    </Prose>
  );
}
