import Link from "next/link";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";
import { LogoMark } from "./LogoMark";

export function Logo({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <Link
      href="/"
      className={cn("flex min-h-11 items-center gap-2.5 rounded-sm", tone === "dark" ? "text-navy" : "text-white", className)}
      aria-label={`${brand.name} home`}
    >
      <LogoMark className={cn("size-9 shrink-0", tone === "light" && "rounded-[9px] ring-1 ring-white/25")} />
      <span className="font-display text-[22px] font-semibold leading-none tracking-[-0.01em]">{brand.name}</span>
    </Link>
  );
}
