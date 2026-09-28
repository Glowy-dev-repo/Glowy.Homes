"use client";

import { Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Hide or show the estimate on one listing, when a seller asks through their listing broker. */
export function HideEstimateForm() {
  const id = useId();
  const [listingId, setListingId] = useState("");
  const [state, setState] = useState<{ busy: boolean; message: string | null; error: boolean }>({ busy: false, message: null, error: false });
  const send = async (hide: boolean) => {
    const target = listingId.trim().match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
    if (!target) return setState({ busy: false, message: "Paste a listing link or listing ID.", error: true });
    setState({ busy: true, message: null, error: false });
    const res = await fetch(`/api/admin/listings/${target}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hideEstimate: hide }) });
    setState({ busy: false, message: res.ok ? (hide ? "Estimate hidden on that listing." : "Estimate shown again on that listing.") : "We could not update that listing.", error: !res.ok });
  };
  return (
    <div className="grid max-w-xl gap-2">
      <label htmlFor={`${id}-listing`} className="text-small font-medium text-neutral-800">Listing link or ID</label>
      <Input id={`${id}-listing`} value={listingId} onChange={(e) => setListingId(e.target.value)} placeholder="https://glowy.homes/listing/..." />
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => send(true)} disabled={state.busy}>{state.busy && <Loader2 className="animate-spin" aria-hidden />}Hide estimate</Button>
        <Button type="button" variant="secondary" onClick={() => send(false)} disabled={state.busy}>Show estimate</Button>
      </div>
      {state.message && <p role={state.error ? "alert" : "status"} className={state.error ? "text-small text-danger" : "text-small text-neutral-700"}>{state.message}</p>}
    </div>
  );
}
