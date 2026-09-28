import { brand } from "@/config/brand";
import { mls } from "@/config/broker";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Required notices on pages that show MLS listings (CSMAR Rules 12.16.7, 12.16.8 and 12.16.21):
 * the source MLS, when the data was last updated, personal use only, and the disclaimer. Demo
 * listings say plainly that they are demo data instead.
 */
export function MlsDisclaimer({ demo, updatedAt, className }: { demo: boolean; updatedAt: string | null; className?: string }) {
  if (demo) {
    return (
      <p className={cn("text-small text-neutral-600", className)} data-testid="mls-disclaimer">
        These are demo listings created for {brand.name} to show how the site works. They are not real homes for sale or rent.
      </p>
    );
  }
  const asOf = updatedAt ? formatDate(updatedAt) : "the most recent update";
  return (
    <div className={cn("space-y-2 text-small text-neutral-600", className)} data-testid="mls-disclaimer">
      <p>
        Listing information source: {mls.shortName}. Last updated {asOf}.
      </p>
      <p>
        Based on information from the {mls.name} (alternatively, from the {mls.shortName}) as of {asOf}. All data, including all measurements and calculations of area, is obtained from various sources and has not been, and will not be, verified by broker or MLS. All information should be independently reviewed and verified for accuracy. Properties may or may not be listed by the office/agent presenting the information.
      </p>
      <p>The information provided is for consumers&apos; personal, non commercial use and may not be used for any purpose other than to identify prospective properties consumers may be interested in purchasing or renting.</p>
    </div>
  );
}
