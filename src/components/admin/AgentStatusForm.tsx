"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ProStatusAction } from "@/lib/pros/status-rules";

const LABEL: Record<ProStatusAction, string> = { approve: "Approve", reject: "Do not approve", suspend: "Suspend", reactivate: "Reactivate" };
const NEEDS_REASON: ProStatusAction[] = ["reject", "suspend"];

/** Admin actions on a partner agent. Reject and suspend ask for a reason (the agent sees it) and a confirmation. */
export function AgentStatusForm({ proId, actions }: { proId: string; actions: ProStatusAction[] }) {
  const router = useRouter();
  const id = useId();
  const [pending, setPending] = useState<ProStatusAction | null>(null);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "saving" | "done" | "error"; message?: string }>({ kind: "idle" });

  const send = async (action: ProStatusAction) => {
    setState({ kind: "saving" });
    const res = await fetch(`/api/admin/agents/${proId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason: reason || undefined }),
    });
    const body = (await res.json().catch(() => null)) as { error?: { message?: string; fields?: Record<string, string[]> } } | null;
    if (!res.ok) {
      setState({ kind: "error", message: body?.error?.fields?.reason?.[0] ?? body?.error?.message ?? "Could not save. Try again." });
      return;
    }
    setPending(null);
    setReason("");
    setState({ kind: "done", message: `${LABEL[action]}: saved. The agent was emailed.` });
    router.refresh();
  };

  if (!actions.length) return null;
  return (
    <div data-testid="agent-status-form" className="space-y-3">
      {pending ? (
        <div className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-4">
          <label htmlFor={`${id}-reason`} className="block text-small font-medium text-neutral-800">
            Reason (the agent sees this in their email)
          </label>
          <textarea
            id={`${id}-reason`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full rounded-md border border-neutral-300 bg-white p-2 text-base"
          />
          <div className="flex flex-wrap gap-2">
            <Button className="bg-danger hover:bg-danger/90" onClick={() => send(pending)} disabled={state.kind === "saving"}>
              {state.kind === "saving" && <Loader2 className="animate-spin" aria-hidden />}
              Confirm: {LABEL[pending]}
            </Button>
            <Button variant="ghost" onClick={() => setPending(null)} disabled={state.kind === "saving"}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button
              key={a}
              variant={NEEDS_REASON.includes(a) ? "secondary" : "primary"}
              disabled={state.kind === "saving"}
              onClick={() => (NEEDS_REASON.includes(a) ? (setPending(a), setState({ kind: "idle" })) : send(a))}
            >
              {LABEL[a]}
            </Button>
          ))}
        </div>
      )}
      <p role="status" className={state.kind === "error" ? "text-small text-danger" : "text-small text-neutral-700"}>
        {state.message ?? ""}
      </p>
    </div>
  );
}
