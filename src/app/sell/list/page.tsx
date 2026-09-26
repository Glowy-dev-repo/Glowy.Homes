import type { Metadata } from "next";
import { ListingWizard } from "@/components/listing/ListingWizard";

export const metadata: Metadata = { title: "List your home for sale", robots: { index: false }, alternates: { canonical: "/sell/list" } };

/** docs/01 SE2: for sale by owner listing wizard. */
export default function ForSaleByOwnerPage() {
  return (
    <div className="container-page py-10">
      <h1 className="mb-2 text-h1">List your home for sale</h1>
      <p className="mb-8 text-body text-neutral-700">Buyers contact you directly. Every listing is reviewed before it goes live.</p>
      <ListingWizard kind="sale" />
    </div>
  );
}
