"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithEmail, type SignInState } from "@/server/actions/auth";

export function EmailSignInForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInWithEmail, { status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  // Move focus to the field after a validation error (WCAG focus management).
  useEffect(() => {
    if (state.fieldError) inputRef.current?.focus();
  }, [state]);

  return (
    <form action={action} noValidate className="grid gap-4">
      {state.status === "error" && state.message && (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-small text-danger">
          {state.message}
        </p>
      )}
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/account"} />
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          ref={inputRef}
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          aria-invalid={state.fieldError ? true : undefined}
          aria-describedby={state.fieldError ? "email-error" : "email-help"}
        />
        {state.fieldError ? (
          <p id="email-error" className="text-small text-danger">
            {state.fieldError}
          </p>
        ) : (
          <p id="email-help" className="text-small text-neutral-600">
            We will email you a link to sign in. No password needed.
          </p>
        )}
      </div>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {pending ? "Sending link" : "Email me a sign in link"}
      </Button>
    </form>
  );
}
