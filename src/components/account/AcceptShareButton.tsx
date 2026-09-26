"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function AcceptShareButton({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accept = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/shares/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    if (res.ok) return router.push("/account/shared");
    const b = (await res.json().catch(() => null)) as { error?: { message: string } } | null;
    setError(b?.error?.message ?? "We could not accept the invitation.");
    setBusy(false);
  };
  return (
    <div>
      <Button onClick={accept} disabled={busy}>{busy && <Loader2 className="animate-spin" aria-hidden />}Accept and see the list</Button>
      {error && <p role="alert" className="mt-2 text-small text-danger">{error}</p>}
    </div>
  );
}
