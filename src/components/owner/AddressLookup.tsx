"use client";

import { Loader2, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";

/** /home-value lookup (docs/01 US3): any address in the covered cities opens its value page. */
export function AddressLookup(props: { defaultValue?: string; autoFocus?: boolean; prefillFromUrl?: boolean }) {
  return props.prefillFromUrl ? <FromUrl {...props} /> : <Lookup {...props} />;
}

function FromUrl(props: { autoFocus?: boolean }) {
  const params = useSearchParams();
  return <Lookup {...props} defaultValue={params.get("address") ?? ""} />;
}

function Lookup({ defaultValue = "", autoFocus = false }: { defaultValue?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState(defaultValue);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/properties/lookup?address=${encodeURIComponent(value)}`);
      const body = (await res.json()) as { data: { href: string } | null; error: { message: string; fields?: Record<string, string[]> } | null };
      if (!res.ok || !body.data) {
        setError(body.error?.fields?.address?.[0] ?? body.error?.message ?? "We could not look up that address.");
        return;
      }
      router.push(body.data.href);
    } catch {
      setError("We could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="w-full max-w-2xl">
      <label htmlFor={`${id}-address`} className="mb-2 block text-body font-medium text-neutral-900">
        Your home address
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-white p-2 shadow-raised focus-within:border-accent">
        <Search className="ml-2 size-5 shrink-0 text-neutral-500" aria-hidden />
        <input
          id={`${id}-address`}
          name="address"
          autoComplete="street-address"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="12 Maple Ave, Toronto"
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-error` : `${id}-help`}
          className="h-12 min-w-0 flex-1 bg-transparent text-base text-neutral-900 placeholder:text-neutral-500 focus:outline-none"
        />
        <Button type="submit" size="lg" disabled={pending || value.trim().length < 5}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Get estimate
        </Button>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-2 text-small text-danger">
          {error}
        </p>
      ) : (
        <p id={`${id}-help`} className="mt-2 text-small text-neutral-600">
          Include the street number and city. For a condo, add the unit, like Unit 1204, 88 Harbour St, Toronto.
        </p>
      )}
    </form>
  );
}
