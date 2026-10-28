import Image from "next/image";
import { cn } from "@/lib/utils";

// A plain tint while the photo loads (CLAUDE.md: every image has a blur placeholder).
const BLUR = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAxIDEnPjxyZWN0IHdpZHRoPScxJyBoZWlnaHQ9JzEnIGZpbGw9JyNlMmU4ZjAnLz48L3N2Zz4=";

/** An agent's photo (a media storage key, served through the media loader), or their initials. */
export function AgentAvatar({ name, photoKey, size, className, priority }: { name: string; photoKey: string | null; size: 56 | 96; className?: string; priority?: boolean }) {
  const box = size === 96 ? "size-24 text-display" : "size-14 text-h3";
  if (photoKey) {
    return (
      <Image
        src={photoKey}
        alt={name}
        width={size}
        height={size}
        sizes={`${size}px`}
        placeholder="blur"
        blurDataURL={BLUR}
        priority={priority}
        className={cn("shrink-0 rounded-full object-cover", box, className)}
      />
    );
  }
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-full bg-accent/10 text-accent", box, className)}>
      {name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
    </span>
  );
}
