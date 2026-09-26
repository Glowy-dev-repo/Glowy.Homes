"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Apply to a rental with the saved application, no retyping (docs/05 Phase 5 criterion 3). */
export function ApplyButton({ listingId, className }: { listingId: string; className?: string }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const { data: app, isLoading } = useQuery({
    queryKey: ["my-application"],
    queryFn: async () => ((await (await fetch("/api/rentals/applications")).json()) as { data: { id: string; profile: { fullName: string } } | null }).data,
    enabled: open && status === "authenticated",
  });

  const start = () => {
    // While the session is still loading, open the dialog; the query waits for it.
    if (status === "unauthenticated") return router.push(`/signin?callbackUrl=${encodeURIComponent(pathname)}`);
    setOpen(true);
  };
  const send = async () => {
    setState("sending");
    setError(null);
    const res = await fetch(`/api/rentals/applications/${app!.id}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId }) });
    if (res.ok) return setState("sent");
    const b = (await res.json().catch(() => null)) as { error?: { message: string } } | null;
    setError(b?.error?.message ?? "We could not send your application.");
    setState("idle");
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <button type="button" onClick={start} className={className}>Apply</button>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-raised">
          <Dialog.Title className="text-h2">Apply to this rental</Dialog.Title>
          <Dialog.Description className="mt-1 text-body text-neutral-600">Your saved application goes to the landlord.</Dialog.Description>
          <div className="mt-5">
            {isLoading || status === "loading" ? (
              <Loader2 className="animate-spin" aria-label="Loading" />
            ) : state === "sent" ? (
              <p role="status" className="flex items-center gap-2 text-body"><CheckCircle2 className="size-5 text-success" aria-hidden />Application sent. Track it in your account.</p>
            ) : app ? (
              <div className="grid gap-3">
                <p className="text-body">Send the application for <strong>{app.profile.fullName}</strong>?</p>
                {error && <p role="alert" className="text-small text-danger">{error}</p>}
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" asChild><Link href={`/account/application?next=${encodeURIComponent(pathname)}`}>Edit it first</Link></Button>
                  <Button onClick={send} disabled={state === "sending"}>{state === "sending" && <Loader2 className="animate-spin" aria-hidden />}Send application</Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-3">
                <p className="text-body">You do not have a rental application yet. It takes about three minutes, and you can reuse it for every rental.</p>
                <Button asChild><Link href={`/account/application?next=${encodeURIComponent(pathname)}`}>Create my application</Link></Button>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
