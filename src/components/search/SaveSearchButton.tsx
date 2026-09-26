"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Bell, Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALERT_FREQUENCIES, ALERT_LABELS, type AlertFrequency } from "@/lib/saved-search-schema";
import type { SearchParams } from "@/types/search";

const INTENT = "saveSearch";

/** "Save search" (docs/04 FilterBar): name it, pick an alert frequency. Resumes after sign in. */
export function SaveSearchButton({
  params,
  defaultName,
  variant = "secondary",
  label = "Save search",
  resumeIntent = true,
}: {
  params: SearchParams;
  defaultName: string;
  variant?: "secondary" | "primary";
  label?: string;
  /** Only one button per page should reopen the dialog after sign in. */
  resumeIntent?: boolean;
}) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [frequency, setFrequency] = useState<AlertFrequency>("daily");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setName(defaultName), [defaultName]);

  // Reopen after returning from sign in.
  useEffect(() => {
    if (status !== "authenticated" || !resumeIntent) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get(INTENT) !== "1") return;
    url.searchParams.delete(INTENT);
    window.history.replaceState(null, "", url.pathname + url.search);
    setOpen(true);
  }, [status, resumeIntent]);

  const start = () => {
    if (status !== "authenticated") {
      const url = new URL(window.location.href);
      url.searchParams.set(INTENT, "1");
      router.push(`/signin?callbackUrl=${encodeURIComponent(`${pathname}${url.search}`)}`);
      return;
    }
    setState("idle");
    setError(null);
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("saving");
    setError(null);
    const res = await fetch("/api/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, filters: { ...params, page: 1 }, alertFrequency: frequency }),
    });
    if (res.ok) {
      setState("saved");
      return;
    }
    const body = (await res.json().catch(() => null)) as { error?: { message?: string; fields?: Record<string, string[]> } } | null;
    setError(body?.error?.fields?.name?.[0] ?? body?.error?.message ?? "We could not save this search. Try again.");
    setState("error");
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Button variant={variant} className="rounded-pill" onClick={start}>
        <Bell aria-hidden />
        {label}
      </Button>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-raised focus:outline-none">
          <Dialog.Title className="text-h2">Save this search</Dialog.Title>
          <Dialog.Description className="mt-1 text-body text-neutral-600">We will email you when new homes match.</Dialog.Description>
          {state === "saved" ? (
            <div className="mt-5" role="status">
              <p className="text-body text-neutral-900">Saved. You can change alerts any time in your account.</p>
              <div className="mt-5 flex justify-end gap-2">
                <Button asChild variant="ghost">
                  <Link href="/account/searches">Manage saved searches</Link>
                </Button>
                <Dialog.Close asChild>
                  <Button>Done</Button>
                </Dialog.Close>
              </div>
            </div>
          ) : (
            <form onSubmit={save} className="mt-5 grid gap-4" noValidate>
              <div>
                <label htmlFor={`${id}-name`} className="mb-1 block text-small font-medium text-neutral-800">
                  Name
                </label>
                <Input
                  id={`${id}-name`}
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={!!error || undefined}
                  aria-describedby={error ? `${id}-error` : undefined}
                />
              </div>
              <div>
                <label htmlFor={`${id}-freq`} className="mb-1 block text-small font-medium text-neutral-800">
                  Email alerts
                </label>
                <select
                  id={`${id}-freq`}
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as AlertFrequency)}
                  className="h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-base"
                >
                  {ALERT_FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {ALERT_LABELS[f]}
                    </option>
                  ))}
                </select>
              </div>
              {error && (
                <p id={`${id}-error`} role="alert" className="text-small text-danger">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <Button type="button" variant="ghost">
                    Cancel
                  </Button>
                </Dialog.Close>
                <Button type="submit" disabled={state === "saving"}>
                  {state === "saving" && <Loader2 className="animate-spin" aria-hidden />}
                  Save search
                </Button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
