import Link from "next/link";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("flex min-h-11 items-center gap-2 rounded-sm font-semibold text-neutral-900", className)}
      aria-label={`${brand.name} home`}
    >
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-md bg-accent text-[13px] font-bold tracking-tight text-white"
      >
        {brand.short}
      </span>
      <span className="text-h3">{brand.name}</span>
    </Link>
  );
}
