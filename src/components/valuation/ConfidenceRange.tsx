"use client";

import * as Popover from "@radix-ui/react-popover";
import { Info } from "lucide-react";
import { CONFIDENCE_EXPLANATION, type Confidence } from "@/types/valuation";

const LABEL: Record<Confidence, string> = { low: "Low", medium: "Medium", high: "High" };

/** "Confidence: High (i)" with an accessible explanation (docs/04 EstimateCard). */
export function ConfidenceLabel({ confidence }: { confidence: Confidence }) {
  return (
    <span className="inline-flex items-center gap-1 text-small text-neutral-700" data-testid="estimate-confidence">
      Confidence: <span className="font-semibold text-neutral-900">{LABEL[confidence]}</span>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button type="button" aria-label="What confidence means" className="grid size-8 place-items-center rounded-full text-neutral-500 hover:bg-neutral-100">
            <Info className="size-4" aria-hidden />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content side="top" sideOffset={6} className="z-50 max-w-xs rounded-md bg-neutral-900 px-3 py-2 text-small text-white shadow-raised">
            {CONFIDENCE_EXPLANATION[confidence]}
            <Popover.Arrow className="fill-neutral-900" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </span>
  );
}
