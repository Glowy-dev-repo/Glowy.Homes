import { notFound, permanentRedirect } from "next/navigation";
import { getListingDetail } from "@/lib/listings/detail";
import { listingPath } from "@/lib/listings/ldp";

// /listing/{id} without the address slug redirects to the canonical URL.
export default async function ListingIdRedirect({ params }: { params: Promise<{ id: string }> }) {
  const l = await getListingDetail((await params).id);
  if (!l) notFound();
  permanentRedirect(listingPath(l));
}
