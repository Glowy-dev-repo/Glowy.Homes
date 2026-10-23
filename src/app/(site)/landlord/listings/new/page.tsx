import type { Metadata } from "next";
import { ListingWizard } from "@/components/listing/ListingWizard";

export const metadata: Metadata = { title: "List a rental", robots: { index: false }, alternates: { canonical: "/landlord/listings/new" } };

export default function NewRentalPage() {
  return (
    <div className="container-page py-10">
      <h1 className="mb-2 text-h1">List a rental</h1>
      <p className="mb-8 text-body text-neutral-700">Renters can inquire and apply once your listing is approved.</p>
      <ListingWizard kind="rent" />
    </div>
  );
}
