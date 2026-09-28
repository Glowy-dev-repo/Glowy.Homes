import Link from "next/link";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";
import { LogoMark } from "./LogoMark";

/** Logo blue from the brand files (public/brand/logo-color.svg). Used for the logo only, at large bold sizes. */
const LOGO_BLUE = "#118DF0";

export function Logo({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <Link
      href="/"
      className={cn("flex min-h-11 items-center gap-2 rounded-sm", className)}
      style={{ color: tone === "dark" ? LOGO_BLUE : "#FFFFFF" }}
      aria-label={`${brand.name} home`}
    >
      <LogoMark className="h-6 w-auto shrink-0" />
      <span className="font-sans text-[24px] font-bold leading-none tracking-[-0.02em]">{brand.name}</span>
    </Link>
  );
}
