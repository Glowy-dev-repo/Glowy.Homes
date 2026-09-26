"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href.split("?")[0];
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Dismissed: fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={share}
        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 text-body font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
      >
        {copied ? <Check className="size-5 text-success" aria-hidden /> : <Share2 className="size-5 text-neutral-700" aria-hidden />}
        {copied ? "Link copied" : "Share"}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Link copied to clipboard" : ""}
      </span>
    </>
  );
}
