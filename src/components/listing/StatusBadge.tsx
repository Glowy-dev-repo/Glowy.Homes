import { cn } from "@/lib/utils";

// docs/04 rule 2: green active, amber pending, neutral sold or leased, red withdrawn.
// Text always carries the meaning; the dot is the color cue.
const STYLES: Record<string, { dot: string; label: (type: "sale" | "rent") => string }> = {
  active: { dot: "bg-success", label: (t) => (t === "rent" ? "For rent" : "For sale") },
  pending: { dot: "bg-warning", label: () => "Pending" },
  sold: { dot: "bg-neutral-500", label: () => "Sold" },
  leased: { dot: "bg-neutral-500", label: () => "Leased" },
  withdrawn: { dot: "bg-danger", label: () => "Withdrawn" },
  expired: { dot: "bg-danger", label: () => "Expired" },
};

export function StatusBadge({
  status,
  listingType,
  className,
}: {
  status: string;
  listingType: "sale" | "rent";
  className?: string;
}) {
  const style = STYLES[status] ?? STYLES.active;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill bg-white/95 px-2.5 py-1 text-[12px] font-semibold text-neutral-900 shadow-card",
        className,
      )}
    >
      <span aria-hidden className={cn("size-2 rounded-full", style.dot)} />
      {style.label(listingType)}
    </span>
  );
}
