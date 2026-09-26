"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { areaUnitLabel, formatPrice, toSqft } from "@/lib/format";
import { contactInfoIn, fairHousingIssue, MIN_PHOTOS } from "@/lib/listings/moderation-checks";
import { cn } from "@/lib/utils";
import { PhotoUploader, type UploadedPhoto } from "./PhotoUploader";
import { market } from "@/config/market";

type Kind = "sale" | "rent";
const STEPS = ["Address", "Facts", "Photos", "Price", "Description", "Contact", "Review"] as const;
const TYPES = [
  ["detached", "Detached"],
  ["semi", "Semi detached"],
  ["townhouse", "Townhouse"],
  ["condo", "Condo"],
  ["multi", "Multi unit"],
] as const;

type Draft = {
  address: string;
  propertyId: string | null;
  resolved: string | null;
  propertyType: string;
  beds: string;
  baths: string;
  area: string;
  yearBuilt: string;
  photos: UploadedPhoto[];
  price: string;
  availableDate: string;
  pets: boolean;
  furnished: boolean;
  laundry: "In suite" | "Shared" | "None";
  parking: boolean;
  leaseMinMonths: string;
  deposit: string;
  description: string;
  preferred: "email" | "phone";
  phone: string;
  showPhone: boolean;
};

/**
 * Shared listing wizard (docs/05 Phase 5 task 1): FSBO sellers and landlords go through the same
 * steps. Every step validates before moving on; the server validates everything again.
 */
export function ListingWizard({ kind }: { kind: Kind }) {
  const id = useId();
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>({
    address: "", propertyId: null, resolved: null, propertyType: kind === "rent" ? "condo" : "detached", beds: "", baths: "", area: "", yearBuilt: "",
    photos: [], price: "", availableDate: "", pets: false, furnished: false, laundry: "In suite", parking: false, leaseMinMonths: "12", deposit: "",
    description: "", preferred: "email", phone: "", showPhone: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ listingId: string; failedChecks: string[] } | null>(null);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const readyPhotos = d.photos.filter((p) => p.status === "done");

  const resolveAddress = async () => {
    setBusy(true);
    setErrors({});
    const res = await fetch(`/api/properties/lookup?address=${encodeURIComponent(d.address)}`);
    const body = (await res.json()) as { data?: { propertyId: string; href: string }; error?: { message: string } };
    setBusy(false);
    if (!res.ok || !body.data) {
      setErrors({ address: body.error?.message ?? "We could not find that address." });
      return false;
    }
    set({ propertyId: body.data.propertyId, resolved: d.address });
    return true;
  };

  const validate = async (): Promise<boolean> => {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (!d.propertyId || d.resolved !== d.address) return resolveAddress();
    }
    if (step === 1) {
      if (d.beds === "") e.beds = "Enter the number of bedrooms.";
      if (d.baths === "") e.baths = "Enter the number of bathrooms.";
      if (!d.area || Number(d.area) < 15) e.area = "Enter the interior size.";
    }
    if (step === 2) {
      if (readyPhotos.length < MIN_PHOTOS) e.photos = `Add at least ${MIN_PHOTOS} photos. ${readyPhotos.length} ready so far.`;
      if (d.photos.some((p) => p.status === "uploading")) e.photos = "Wait for your photos to finish uploading.";
    }
    if (step === 3) {
      if (!d.price || Number(d.price) <= 0) e.price = "Enter a price.";
      if (kind === "rent" && !d.availableDate) e.availableDate = "Choose when it is available.";
    }
    if (step === 4) {
      if (d.description.trim().length < 40) e.description = "Describe the home in at least 40 characters.";
      else if (contactInfoIn(d.description)) e.description = "Remove phone numbers, emails and links. Buyers contact you through the listing.";
      else if (fairHousingIssue(d.description)) e.description = "Listings cannot exclude people based on family status, religion, disability or other protected grounds.";
    }
    if (step === 5 && d.preferred === "phone" && !/^\+?\d{10,15}$/.test(d.phone.replace(/[^\d+]/g, ""))) e.phone = "Enter a phone number with area code.";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const next = async () => {
    if (await validate()) setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const submit = async () => {
    setBusy(true);
    setErrors({});
    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listingType: kind,
        propertyId: d.propertyId,
        propertyType: d.propertyType,
        beds: Number(d.beds),
        baths: Number(d.baths),
        sqft: toSqft(Number(d.area)),
        yearBuilt: d.yearBuilt ? Number(d.yearBuilt) : undefined,
        price: Number(d.price),
        description: d.description,
        availableDate: kind === "rent" ? d.availableDate : undefined,
        rentalTerms:
          kind === "rent"
            ? { pets: d.pets, furnished: d.furnished, laundry: d.laundry, parking: d.parking, leaseMinMonths: Number(d.leaseMinMonths) || 12, deposit: Number(d.deposit) || Number(d.price), utilitiesIncluded: [] }
            : undefined,
        photos: readyPhotos.map((p) => ({ storageKey: p.storageKey, sourceUrl: p.sourceUrl, blurDataUrl: p.blurDataUrl, width: p.width, height: p.height })),
        contact: { preferred: d.preferred, phone: d.phone || undefined, showPhone: d.showPhone },
      }),
    });
    const body = (await res.json().catch(() => null)) as { data?: { listingId: string; failedChecks: string[] }; error?: { message: string; fields?: Record<string, string[]> } } | null;
    setBusy(false);
    if (!res.ok || !body?.data) {
      const f: Record<string, string> = { _: body?.error?.message ?? "We could not submit your listing." };
      for (const [k, v] of Object.entries(body?.error?.fields ?? {})) f[k] = v[0];
      setErrors(f);
      return;
    }
    setDone(body.data);
  };

  if (done) {
    return (
      <div role="status" className="max-w-xl rounded-lg border border-neutral-200 p-6" data-testid="listing-submitted">
        <p className="flex items-center gap-2 text-h2"><CheckCircle2 className="size-6 text-success" aria-hidden />Submitted for review</p>
        <p className="mt-2 text-body text-neutral-700">We review every listing, which typically takes less than a day. We will email you when it is live.</p>
        {done.failedChecks.length > 0 && <p className="mt-2 text-small text-neutral-700">Our reviewer will take a closer look at: {done.failedChecks.join(", ")}.</p>}
        <Button asChild className="mt-5"><Link href="/landlord">Go to my listings</Link></Button>
      </div>
    );
  }

  const text = (key: keyof Draft, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="grid gap-1">
      <label htmlFor={`${id}-${key}`} className="text-small font-medium text-neutral-800">{label}</label>
      <Input id={`${id}-${key}`} value={d[key] as string} onChange={(e) => set({ [key]: e.target.value } as Partial<Draft>)} aria-invalid={!!errors[key] || undefined} aria-describedby={errors[key] ? `${id}-${key}-e` : undefined} {...props} />
      {errors[key] && <p id={`${id}-${key}-e`} className="text-small text-danger">{errors[key]}</p>}
    </div>
  );
  const check = (key: "pets" | "furnished" | "parking" | "showPhone", label: string) => (
    <label className="flex min-h-11 items-center gap-3 text-body">
      <input type="checkbox" checked={d[key]} onChange={(e) => set({ [key]: e.target.checked } as Partial<Draft>)} className="size-5 accent-[var(--color-accent)]" />
      {label}
    </label>
  );

  return (
    <div className="max-w-2xl">
      <ol className="mb-8 grid grid-cols-7 gap-1" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={cn("border-t-4 pt-1 text-[12px] sm:text-small", i <= step ? "border-accent font-semibold text-neutral-900" : "border-neutral-200 text-neutral-500")}>
            <span className="hidden sm:inline">{s}</span>
            <span className="sm:hidden">{i + 1}</span>
          </li>
        ))}
      </ol>
      <h2 className="mb-4 text-h2">{STEPS[step]}</h2>
      {errors._ && <p role="alert" className="mb-4 rounded-md bg-danger/5 px-3 py-2 text-small text-danger">{errors._}</p>}

      {step === 0 && (
        <div className="grid gap-2">
          {text("address", "Street address and city", { autoComplete: "street-address", placeholder: market.exampleAddress })}
          <p className="text-small text-neutral-600">For a condo, include the unit, like {market.exampleUnitAddress}.</p>
          {d.propertyId && d.resolved === d.address && <p className="text-small text-success" role="status">Address found.</p>}
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1 sm:col-span-2">
            <label htmlFor={`${id}-type`} className="text-small font-medium text-neutral-800">Home type</label>
            <select id={`${id}-type`} value={d.propertyType} onChange={(e) => set({ propertyType: e.target.value })} className="h-11 rounded-md border border-neutral-300 bg-white px-3 text-base">
              {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {text("beds", "Bedrooms", { type: "number", inputMode: "numeric", min: 0 })}
          {text("baths", "Bathrooms", { type: "number", inputMode: "decimal", min: 0, step: 0.5 })}
          {text("area", `Interior size (${areaUnitLabel})`, { type: "number", inputMode: "numeric", min: 10 })}
          {text("yearBuilt", "Year built (optional)", { type: "number", inputMode: "numeric", min: 1800 })}
        </div>
      )}

      {step === 2 && <PhotoUploader photos={d.photos} onChange={(p) => setD((x) => ({ ...x, photos: typeof p === "function" ? p(x.photos) : p }))} error={errors.photos} />}

      {step === 3 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {text("price", kind === "rent" ? "Monthly rent ($)" : "Asking price ($)", { type: "number", inputMode: "numeric", min: 1 })}
          {kind === "rent" && text("availableDate", "Available from", { type: "date" })}
          {kind === "rent" && text("deposit", "Deposit ($, optional)", { type: "number", inputMode: "numeric", min: 0 })}
          {kind === "rent" && text("leaseMinMonths", "Minimum lease (months)", { type: "number", inputMode: "numeric", min: 1, max: 36 })}
          {kind === "rent" && (
            <div className="grid gap-1">
              <label htmlFor={`${id}-laundry`} className="text-small font-medium text-neutral-800">Laundry</label>
              <select id={`${id}-laundry`} value={d.laundry} onChange={(e) => set({ laundry: e.target.value as Draft["laundry"] })} className="h-11 rounded-md border border-neutral-300 bg-white px-3 text-base">
                {["In suite", "Shared", "None"].map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
          )}
          {kind === "rent" && <div className="sm:col-span-2">{check("pets", "Pets allowed")}{check("furnished", "Furnished")}{check("parking", "Parking included")}</div>}
        </div>
      )}

      {step === 4 && (
        <div className="grid gap-1">
          <label htmlFor={`${id}-desc`} className="text-small font-medium text-neutral-800">Description</label>
          <textarea id={`${id}-desc`} rows={8} maxLength={4000} value={d.description} onChange={(e) => set({ description: e.target.value })} aria-invalid={!!errors.description || undefined} aria-describedby={`${id}-desc-help`} className="rounded-md border border-neutral-300 p-3 text-base" />
          <p id={`${id}-desc-help`} className={cn("text-small", errors.description ? "text-danger" : "text-neutral-600")}>
            {errors.description ?? "What makes the home special. Do not include phone numbers, emails or links."}
          </p>
        </div>
      )}

      {step === 5 && (
        <div className="grid gap-4">
          <fieldset>
            <legend className="mb-2 text-small font-medium text-neutral-800">How should people reach you?</legend>
            {(["email", "phone"] as const).map((p) => (
              <label key={p} className="flex min-h-11 items-center gap-3 text-body">
                <input type="radio" name="preferred" checked={d.preferred === p} onChange={() => set({ preferred: p })} className="size-5 accent-[var(--color-accent)]" />
                {p === "email" ? "Messages to my email" : "Phone calls or texts"}
              </label>
            ))}
          </fieldset>
          {text("phone", d.preferred === "phone" ? "Phone" : "Phone (optional)", { type: "tel", inputMode: "tel", autoComplete: "tel" })}
          {check("showPhone", "Show my phone number on the listing")}
        </div>
      )}

      {step === 6 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border border-neutral-200 p-5 text-body">
          <dt className="text-neutral-600">Address</dt><dd>{d.resolved}</dd>
          <dt className="text-neutral-600">Home</dt><dd>{TYPES.find((t) => t[0] === d.propertyType)?.[1]}, {d.beds} bd, {d.baths} ba, {d.area} {areaUnitLabel}</dd>
          <dt className="text-neutral-600">Photos</dt><dd>{readyPhotos.length}</dd>
          <dt className="text-neutral-600">Price</dt><dd>{d.price ? formatPrice(Number(d.price), { listingType: kind }) : ""}</dd>
          {kind === "rent" && <><dt className="text-neutral-600">Available</dt><dd>{d.availableDate}</dd></>}
          <dt className="text-neutral-600">Contact</dt><dd>{d.preferred === "email" ? "Email" : `Phone ${d.phone}`}</dd>
        </dl>
      )}

      <div className="mt-8 flex justify-between gap-2">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || busy}>Back</Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next} disabled={busy}>{busy && <Loader2 className="animate-spin" aria-hidden />}Continue</Button>
        ) : (
          <Button onClick={submit} disabled={busy}>{busy && <Loader2 className="animate-spin" aria-hidden />}Submit for review</Button>
        )}
      </div>
    </div>
  );
}
