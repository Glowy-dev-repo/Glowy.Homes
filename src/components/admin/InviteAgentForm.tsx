"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Invite an agent to apply: they get an email explaining how Glowy Homes works, with a link to apply. */
export function InviteAgentForm() {
  const router = useRouter();
  const id = useId();
  const [state, setState] = useState<{ kind: "idle" | "sending" | "sent" | "error"; message?: string }>({ kind: "idle" });

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const email = String(f.get("email") ?? "");
    setState({ kind: "sending" });
    const res = await fetch("/api/admin/agents/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name: f.get("name") || undefined }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { error?: { message?: string; fields?: Record<string, string[]> } } | null;
    if (!res?.ok) {
      setState({ kind: "error", message: body?.error?.fields?.email?.[0] ?? body?.error?.message ?? "Could not send the invite. Try again." });
      return;
    }
    form.reset();
    setState({ kind: "sent", message: `Invite sent to ${email.trim().toLowerCase()}.` });
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3" data-testid="invite-agent">
      <div className="grid gap-1">
        <label htmlFor={`${id}-email`} className="text-small font-medium text-neutral-800">
          Agent&apos;s email
        </label>
        <Input id={`${id}-email`} name="email" type="email" required autoComplete="off" className="w-72 max-w-full" />
      </div>
      <div className="grid gap-1">
        <label htmlFor={`${id}-name`} className="text-small font-medium text-neutral-800">
          Name (optional)
        </label>
        <Input id={`${id}-name`} name="name" autoComplete="off" className="w-56 max-w-full" />
      </div>
      <Button type="submit" disabled={state.kind === "sending"}>
        {state.kind === "sending" && <Loader2 className="animate-spin" aria-hidden />}
        Send invite
      </Button>
      <p role="status" className={state.kind === "error" ? "w-full text-small text-danger" : "w-full text-small text-neutral-700"}>
        {state.message ?? ""}
      </p>
    </form>
  );
}
