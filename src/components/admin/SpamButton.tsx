"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Closes a junk lead after a second click to confirm; it then leaves the queue. */
export function SpamButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "confirm" | "saving" | "error">("idle");
  const close = async () => {
    if (state !== "confirm") return setState("confirm");
    setState("saving");
    const res = await fetch(`/api/admin/leads/${leadId}/spam`, { method: "POST" }).catch(() => null);
    if (res?.ok) return router.refresh();
    setState("error");
  };
  return (
    <span className="flex items-center gap-2">
      <Button type="button" variant="ghost" onClick={close} disabled={state === "saving"} data-testid="close-spam">
        {state === "confirm" ? "Yes, close as spam" : "Close as spam"}
      </Button>
      {state === "confirm" && (
        <Button type="button" variant="ghost" onClick={() => setState("idle")}>Cancel</Button>
      )}
      <span role="status" className="text-small text-danger">{state === "error" ? "Could not close this lead." : ""}</span>
    </span>
  );
}
