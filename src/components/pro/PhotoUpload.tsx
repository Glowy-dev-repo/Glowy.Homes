"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { mediaUrl } from "@/lib/media/urls";
import { MAX_PHOTO_BYTES, PHOTO_TYPES } from "@/lib/pros/photo-limits";

/** Profile photo: choose, upload, replace or remove. The server checks and cleans every file. */
export function PhotoUpload({ name, photoKey }: { name: string; photoKey: string | null }) {
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [key, setKey] = useState(photoKey);
  const [state, setState] = useState<{ kind: "idle" | "busy" | "done" | "error"; message?: string }>({ kind: "idle" });

  const upload = async (file: File) => {
    if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) return setState({ kind: "error", message: "Choose a JPG, PNG or WebP photo." });
    if (file.size > MAX_PHOTO_BYTES) return setState({ kind: "error", message: "Photos can be up to 5 MB." });
    setState({ kind: "busy" });
    const body = new FormData();
    body.set("photo", file);
    const res = await fetch("/api/pro/photo", { method: "POST", body }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { data?: { photoUrl: string }; error?: { message: string } } | null;
    if (!res?.ok || !json?.data) return setState({ kind: "error", message: json?.error?.message ?? "Could not upload the photo. Try again." });
    setKey(json.data.photoUrl);
    setState({ kind: "done", message: "Photo saved." });
    router.refresh();
  };

  const remove = async () => {
    setState({ kind: "busy" });
    const res = await fetch("/api/pro/photo", { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return setState({ kind: "error", message: "Could not remove the photo. Try again." });
    setKey(null);
    setState({ kind: "done", message: "Photo removed." });
    router.refresh();
  };

  return (
    <section aria-labelledby={`${id}-h`} className="mb-8 flex flex-wrap items-center gap-5 rounded-lg border border-neutral-200 bg-white p-5" data-testid="photo-upload">
      {key ? (
        // eslint-disable-next-line @next/next/no-img-element -- preview of the agent's own just uploaded photo; next/image would cache the old one
        <img src={mediaUrl(key, 400)} alt={name} className="size-24 rounded-full object-cover" />
      ) : (
        <span aria-hidden className="grid size-24 place-items-center rounded-full bg-accent/10 text-display text-accent">
          {name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
        </span>
      )}
      <div className="space-y-2">
        <h2 id={`${id}-h`} className="text-h3">Profile photo</h2>
        <p className="text-small text-neutral-600">A clear headshot. JPG, PNG or WebP, up to 5 MB.</p>
        <input
          ref={input}
          id={`${id}-file`}
          type="file"
          accept={PHOTO_TYPES.join(",")}
          className="sr-only"
          aria-label="Choose a profile photo"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void upload(f);
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={state.kind === "busy"} onClick={() => input.current?.click()}>
            {state.kind === "busy" && <Loader2 className="animate-spin" aria-hidden />}
            {key ? "Replace photo" : "Upload photo"}
          </Button>
          {key && (
            <Button type="button" variant="ghost" disabled={state.kind === "busy"} onClick={remove}>
              Remove
            </Button>
          )}
        </div>
        <p role="status" className={state.kind === "error" ? "text-small text-danger" : "text-small text-neutral-700"}>
          {state.message ?? ""}
        </p>
      </div>
    </section>
  );
}
