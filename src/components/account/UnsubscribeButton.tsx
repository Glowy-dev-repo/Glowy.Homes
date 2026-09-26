"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function UnsubscribeButton({ id, token }: { id: string; token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const stop = async () => {
    setState("busy");
    const res = await fetch(`/api/saved-searches/${id}/unsubscribe?token=${encodeURIComponent(token)}`, { method: "POST" });
    setState(res.ok ? "done" : "error");
  };
  if (state === "done") return <p role="status" className="text-body font-medium">Alerts stopped for this search.</p>;
  return (
    <div>
      <Button onClick={stop} disabled={state === "busy"}>{state === "busy" && <Loader2 className="animate-spin" aria-hidden />}Stop alerts</Button>
      {state === "error" && <p role="alert" className="mt-2 text-small text-danger">That did not work. Try again, or change alerts from your account.</p>}
    </div>
  );
}
