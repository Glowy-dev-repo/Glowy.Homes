import type { Metadata } from "next";
import Link from "next/link";
import { LandlordDashboard } from "@/components/rentals/LandlordDashboard";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { landlordInquiries, landlordSubmissions } from "@/server/data/rentals";
import { ownerListings } from "@/server/data/user-listings";

export const metadata: Metadata = { title: "My listings", robots: { index: false }, alternates: { canonical: "/landlord" } };
export const dynamic = "force-dynamic";

export default async function LandlordPage() {
  const session = await auth();
  const userId = session!.user.id;
  const [listings, inquiries, applications] = await Promise.all([ownerListings(userId), landlordInquiries(userId), landlordSubmissions(userId)]);
  return (
    <div className="container-page py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1">My listings</h1>
        <div className="flex gap-2">
          <Button asChild><Link href="/landlord/listings/new">List a rental</Link></Button>
          <Button asChild variant="secondary"><Link href="/sell/list">Sell my home</Link></Button>
        </div>
      </div>
      <LandlordDashboard listings={listings} inquiries={inquiries} applications={applications} />
    </div>
  );
}
