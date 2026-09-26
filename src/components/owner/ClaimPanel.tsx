"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type State = { claimedByMe: boolean; claimedByOther: boolean; pendingVerification: boolean; mode: "instant" | "code" };
const INTENT = "claim";

/** "Is this your home? Claim it" (docs/04 property value page, docs/01 US5). */
export function ClaimPanel({ propertyId }: { propertyId: string }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const id = useId();
  const key = ["claim", propertyId, status];
  const { data } = useQuery({
    queryKey: key,
    queryFn: async () => ((await (await fetch(`/api/properties/${propertyId}/claim`)).json()) as { data: State }).data,
    enabled: status !== "loading",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const resumed = useRef(false);

  const claim = async () => {
    if (status !== "authenticated") {
      router.push(`/signin?callbackUrl=${encodeURIComponent(`${pathname}?${INTENT}=1`)}`);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/properties/${propertyId}/claim`, { method: "POST" });
    const body = (await res.json()) as { error?: { message: string } };
    setBusy(false);
    if (!res.ok) setError(body.error?.message ?? "We could not start the claim.");
    await qc.invalidateQueries({ queryKey: ["claim", propertyId] });
  };

  // Resume a claim started before sign in.
  useEffect(() => {
    if (status !== "authenticated" || !data || resumed.current) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get(INTENT) !== "1") return;
    resumed.current = true;
    window.history.replaceState(null, "", url.pathname);
    if (!data.claimedByMe && !data.claimedByOther && !data.pendingVerification) void claim();
  }, [status, data]); // eslint-disable-line react-hooks/exhaustive-deps -- claim reads current state; run once per load

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/properties/${propertyId}/claim/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const body = (await res.json()) as { error?: { message: string; fields?: Record<string, string[]> } };
    setBusy(false);
    if (!res.ok) setError(body.error?.fields?.code?.[0] ?? body.error?.message ?? "That did not work.");
    await qc.invalidateQueries({ queryKey: ["claim", propertyId] });
  };

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-lg border border-neutral-200 p-5" data-testid="claim-panel">
      <h2 id={`${id}-title`} className="text-h3">
        Is this your home?
      </h2>
      {data?.claimedByMe ? (
        <div className="mt-2" role="status">
          <p className="flex items-center gap-2 text-body text-neutral-900">
            <CheckCircle2 className="size-5 text-success" aria-hidden />
            You claimed this home.
          </p>
          <Link href="/account/homes" className="mt-2 inline-flex min-h-11 items-center font-medium text-accent hover:underline">
            Update facts and track its value
          </Link>
        </div>
      ) : data?.claimedByOther ? (
        <p className="mt-2 text-body text-neutral-700">This home has already been claimed by its owner.</p>
      ) : data?.pendingVerification ? (
        <form onSubmit={verify} className="mt-2 grid gap-2" noValidate>
          <p className="text-body text-neutral-700">
            We sent a 6 digit verification code for this address. Enter it to confirm you own this home.
          </p>
          <label htmlFor={`${id}-code`} className="text-small font-medium text-neutral-800">
            Verification code
          </label>
          <div className="flex gap-2">
            <Input
              id={`${id}-code`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              aria-invalid={!!error || undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              className="max-w-40"
            />
            <Button type="submit" disabled={busy || code.length !== 6}>
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              Verify
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-2">
          <p className="text-body text-neutral-700">Claim it to update its facts, refine the estimate and track its value.</p>
          <Button className="mt-3" onClick={claim} disabled={busy || status === "loading"}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            This is my home
          </Button>
        </div>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-small text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
