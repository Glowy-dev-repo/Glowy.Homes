import { brand } from "@/config/brand";

/** Shown on every page while the site runs on synthetic data, so no one mistakes demo homes or agents for real ones. */
export function DemoBanner() {
  if (brand.listingFeed !== "synthetic") return null;
  return (
    <div className="bg-warning/15 px-4 py-2 text-center text-small text-neutral-900" data-testid="demo-banner">
      <strong className="font-semibold">Demo data.</strong> The homes, prices and agents on this site are examples for review, not real listings.
    </div>
  );
}
