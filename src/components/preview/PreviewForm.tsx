"use client";

import { Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PreviewForm({ next }: { next: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const password = new FormData(e.currentTarget).get("password")?.toString() ?? "";
    if (!password) {
      setError("Enter the password.");
      inputRef.current?.focus();
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password, next }) });
      const body = (await res.json().catch(() => ({}))) as { data?: { next?: string } | null; error?: { message?: string } | null };
      if (!res.ok) throw new Error(body.error?.message ?? "Something went wrong. Try again.");
      // Full page load so every page is fetched again with the preview cookie.
      window.location.assign(body.data?.next ?? "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setPending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          ref={inputRef}
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "password-error" : undefined}
        />
        {error && (
          <p id="password-error" role="alert" className="text-small text-danger">
            {error}
          </p>
        )}
      </div>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {pending ? "Checking" : "View the preview"}
      </Button>
    </form>
  );
}
