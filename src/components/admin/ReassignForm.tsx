"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * docs/01 AD4: choose or change a lead's agent. Pros who cover the lead's area are listed first; for a
 * lead waiting for Glowy Homes, the suggested agent is preselected and the action reads "Assign".
 */
export function ReassignForm({
  leadId,
  pros,
  suggestedId = null,
  assigned = true,
}: {
  leadId: string;
  pros: { id: string; displayName: string; proType: string; covers: boolean }[];
  suggestedId?: string | null;
  assigned?: boolean;
}) {
  const router = useRouter();
  const id = useId();
  const [proId, setProId] = useState(suggestedId && pros.some((p) => p.id === suggestedId) ? suggestedId : (pros[0]?.id ?? ""));
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const verb = assigned ? "Reassign" : "Assign";
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
            {p.displayName} ({p.proType}{p.covers ? ", covers area" : ""}{p.id === suggestedId ? ", suggested" : ""})
          </option>
        ))}
      </select>
      <Button type="submit" variant={assigned ? "secondary" : "primary"} disabled={state === "saving" || !proId}>{verb}</Button>
      <span role="status" className="text-small">{state === "done" ? `${verb}ed.` : state === "error" ? `Could not ${verb.toLowerCase()}.` : ""}</span>
    </form>
  );
}
