"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useId, useState } from "react";
import { MIN_PHOTOS } from "@/lib/listings/moderation-checks";

export type UploadedPhoto = {
  localUrl: string;
  storageKey?: string;
  sourceUrl?: string;
  blurDataUrl?: string | null;
  width?: number | null;
  height?: number | null;
  status: "uploading" | "done" | "error";
  error?: string;
};

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX = 10 * 1024 * 1024;

async function uploadOne(file: File): Promise<Partial<UploadedPhoto>> {
  const res = await fetch("/api/media/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: file.type, contentLength: file.size }),
  });
  const body = (await res.json()) as { data?: { mode: "presigned" | "direct"; url: string; publicUrl?: string }; error?: { message: string } };
  if (!res.ok || !body.data) throw new Error(body.error?.message ?? "Upload failed");
  const put = await fetch(body.data.url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!put.ok) {
    const e = (await put.json().catch(() => null)) as { error?: { message: string } } | null;
    throw new Error(e?.error?.message ?? "Upload failed");
  }
  if (body.data.mode === "presigned") return { sourceUrl: body.data.publicUrl };
  const done = (await put.json()) as { data: { storageKey: string; blurDataUrl: string; width: number; height: number } };
  return done.data;
}

/** Photo step (docs/05 Phase 5 task 1): presigned or direct upload, at least three photos. */
export function PhotoUploader({ photos, onChange, error }: { photos: UploadedPhoto[]; onChange: (p: UploadedPhoto[] | ((prev: UploadedPhoto[]) => UploadedPhoto[])) => void; error?: string }) {
  const id = useId();
  const [rejected, setRejected] = useState<string | null>(null);

  const add = async (files: FileList | null) => {
    if (!files) return;
    setRejected(null);
    const accepted = Array.from(files).filter((f) => {
      if (!TYPES.includes(f.type)) return setRejected(`${f.name} is not a JPEG, PNG, WebP or AVIF image.`), false;
      if (f.size > MAX) return setRejected(`${f.name} is larger than 10 MB.`), false;
      return true;
    });
    const fresh = accepted.map((f) => ({ file: f, photo: { localUrl: URL.createObjectURL(f), status: "uploading" as const } }));
    onChange((prev) => [...prev, ...fresh.map((x) => x.photo)]);
    await Promise.all(
      fresh.map(async ({ file, photo }) => {
        try {
          const uploaded = await uploadOne(file);
          onChange((prev) => prev.map((p) => (p.localUrl === photo.localUrl ? { ...p, ...uploaded, status: "done" } : p)));
        } catch (e) {
          onChange((prev) => prev.map((p) => (p.localUrl === photo.localUrl ? { ...p, status: "error", error: e instanceof Error ? e.message : "Upload failed" } : p)));
        }
      }),
    );
  };

  const done = photos.filter((p) => p.status === "done").length;
  return (
    <div>
      <label htmlFor={`${id}-files`} className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-300 p-6 text-center hover:border-accent">
        <ImagePlus className="size-8 text-neutral-500" aria-hidden />
        <span className="text-body font-medium">Add photos</span>
        <span className="text-small text-neutral-600">At least {MIN_PHOTOS}. JPEG, PNG, WebP or AVIF, up to 10 MB each.</span>
      </label>
      <input id={`${id}-files`} type="file" accept={TYPES.join(",")} multiple className="sr-only" onChange={(e) => { void add(e.target.files); e.target.value = ""; }} data-testid="photo-input" />
      <p className="mt-2 text-small text-neutral-700" aria-live="polite" data-testid="photo-count">
        {done} of {Math.max(MIN_PHOTOS, done)} photos ready{done < MIN_PHOTOS ? `, add ${MIN_PHOTOS - done} more` : ""}
      </p>
      {(error || rejected) && (
        <p role="alert" className="mt-1 text-small text-danger">{rejected ?? error}</p>
      )}
      <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((p, i) => (
          <li key={p.localUrl} className="relative aspect-[3/2] overflow-hidden rounded-md bg-neutral-100">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview before upload finishes */}
            <img src={p.localUrl} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
            {p.status === "uploading" && <span className="absolute inset-0 grid place-items-center bg-white/60"><Loader2 className="size-6 animate-spin" aria-label="Uploading" /></span>}
            {p.status === "error" && <span className="absolute inset-x-0 bottom-0 bg-danger px-1 text-[12px] text-white">{p.error}</span>}
            <button type="button" onClick={() => onChange((prev) => prev.filter((x) => x.localUrl !== p.localUrl))} aria-label={`Remove photo ${i + 1}`} className="absolute right-1 top-1 grid size-8 place-items-center rounded-full bg-white/90 shadow-card">
              <X className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
