"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import type { ListingMediaItem } from "@/lib/listings/detail";

function altFor(m: ListingMediaItem, i: number, total: number, address: string) {
  return m.caption ? `${m.caption}, photo ${i + 1} of ${total}, ${address}` : `Photo ${i + 1} of ${total}, ${address}`;
}

/**
 * docs/04 LDP gallery: one large photo plus four on desktop, a full width photo with a counter on
 * mobile, and a full screen viewer with arrow keys, swipe and a visible close button.
 */
export function PhotoGallery({ media, address, virtualTourUrl }: { media: ListingMediaItem[]; address: string; virtualTourUrl?: string | null }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const total = media.length;

  const go = useCallback((delta: number) => setIndex((i) => (i + delta + total) % total), [total]);
  const openAt = (i: number) => {
    setIndex(i);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  const [touchX, setTouchX] = useState<number | null>(null);

  if (!total) {
    return <div className="aspect-[3/2] w-full rounded-lg bg-neutral-100 md:aspect-[21/9]" aria-label="No photos yet" role="img" />;
  }

  const hero = media[0];
  return (
    <div className="relative">
      <div className="grid gap-2 md:grid-cols-4 md:grid-rows-2 md:[height:min(56vw,520px)]">
        <button
          type="button"
          onClick={() => openAt(0)}
          className="relative aspect-[3/2] overflow-hidden bg-neutral-100 md:col-span-2 md:row-span-2 md:aspect-auto md:rounded-l-lg"
        >
          <Image
            src={hero.storageKey}
            alt={altFor(hero, 0, total, address)}
            fill
            priority
            sizes="(min-width: 768px) 50vw, 100vw"
            placeholder={hero.blurDataUrl ? "blur" : "empty"}
            blurDataURL={hero.blurDataUrl ?? undefined}
            className="object-cover"
          />
        </button>
        {media.slice(1, 5).map((m, i) => (
          <button
            key={m.id}
            type="button"
            onClick={() => openAt(i + 1)}
            className={`relative hidden overflow-hidden bg-neutral-100 md:block ${i === 1 ? "md:rounded-tr-lg" : ""} ${i === 3 ? "md:rounded-br-lg" : ""}`}
          >
            <Image
              src={m.storageKey}
              alt={altFor(m, i + 1, total, address)}
              fill
              sizes="25vw"
              placeholder={m.blurDataUrl ? "blur" : "empty"}
              blurDataURL={m.blurDataUrl ?? undefined}
              className="object-cover"
            />
          </button>
        ))}
      </div>

      <div className="absolute bottom-3 right-3 flex gap-2">
        {virtualTourUrl && (
          <a
            href={virtualTourUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-md bg-white px-3 text-small font-semibold text-neutral-900 shadow-card"
          >
            Virtual tour
          </a>
        )}
        <button
          type="button"
          onClick={() => openAt(0)}
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-white px-3 text-small font-semibold text-neutral-900 shadow-card"
        >
          <Images className="size-4" aria-hidden />
          See all {total} photos
        </button>
      </div>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/95" />
          <Dialog.Content
            className="fixed inset-0 z-50 flex flex-col focus:outline-none"
            onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touchX === null) return;
              const dx = e.changedTouches[0].clientX - touchX;
              if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
              setTouchX(null);
            }}
          >
            <div className="flex h-14 items-center justify-between px-4 text-white">
              <Dialog.Title className="text-body" aria-live="polite">
                {index + 1} of {total}
                {media[index].caption ? ` · ${media[index].caption}` : ""}
              </Dialog.Title>
              <Dialog.Description className="sr-only">Use the left and right arrow keys to move between photos.</Dialog.Description>
              <Dialog.Close className="grid size-11 place-items-center rounded-full hover:bg-white/10" aria-label="Close photos">
                <X className="size-6" aria-hidden />
              </Dialog.Close>
            </div>
            <div className="relative flex-1">
              {[index, (index + 1) % total, (index - 1 + total) % total].map((i) => (
                <Image
                  key={media[i].id}
                  src={media[i].storageKey}
                  alt={altFor(media[i], i, total, address)}
                  fill
                  sizes="100vw"
                  className={`object-contain transition-opacity duration-200 ${i === index ? "opacity-100" : "pointer-events-none opacity-0"}`}
                  aria-hidden={i !== index}
                />
              ))}
              <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-2 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-neutral-900 hover:bg-white">
                <ChevronLeft className="size-6" aria-hidden />
              </button>
              <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute right-2 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-neutral-900 hover:bg-white">
                <ChevronRight className="size-6" aria-hidden />
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
