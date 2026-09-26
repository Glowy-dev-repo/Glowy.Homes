import * as React from "react";
import { cn } from "@/lib/utils";

// 16px text so iOS does not zoom on focus; 44px height for touch.
export function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-base text-neutral-900 transition-colors duration-150 placeholder:text-neutral-500 hover:border-neutral-400 focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
}
