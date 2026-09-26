"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";

/** docs/01 AD4: manual reassignment. Pros who cover the lead's area are listed first. */
export function ReassignForm({ leadId, pros }: { leadId: string; pros: { id: string; displayName: string; proType: string; covers: boolean }[] }) {
  const router = useRouter();
  const id = useId();
  const [proId, setProId] = useState(pros[0]?.id ?? "");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("saving");
    const res = await fetch(`/api/admin/leads/${leadId}/reassign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proId }) });
    setState(res.ok ? "done" : "error");
    if (res.ok) router.refresh();
  };
  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2" data-testid="reassign-form">
      <label htmlFor={`${id}-pro`} className="sr-only">Assign to</label>
      <select id={`${id}-pro`} value={proId} onChange={(e) => setProId(e.target.value)} className="h-11 max-w-64 rounded-md border border-neutral-300 bg-white px-2 text-base">
        {pros.map((p) => (
          <option key={p.id} value={p.id}>
            {p.displayName} ({p.proType}{p.covers ? ", covers area" : ""})
          </option>
        ))}
      </select>
      <Button type="submit" variant="secondary" disabled={state === "saving" || !proId}>Reassign</Button>
      <span role="status" className="text-small">{state === "done" ? "Reassigned." : state === "error" ? "Could not reassign." : ""}</span>
    </form>
  );
}
