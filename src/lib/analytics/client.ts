"use client";

import type { EventInput, EventName } from "./events";

// Batched client tracker (docs/03 section 8): flushes every 10 seconds and when the page is hidden.

const FLUSH_MS = 10_000;
const queue: EventInput[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!queue.length) return;
  const body = JSON.stringify({ events: queue.splice(0, 50) });
  const sent = typeof navigator.sendBeacon === "function" && navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
  if (!sent) void fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  if (queue.length) timer = setTimeout(flush, FLUSH_MS);
}

export function track(name: EventName, props: Record<string, string | number | boolean | null | undefined> = {}) {
  if (typeof window === "undefined") return;
  const clean = Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined)) as Record<string, string | number | boolean | null>;
  queue.push({ name, props: clean, at: Date.now() });
  if (!listening) {
    listening = true;
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
    window.addEventListener("pagehide", flush);
  }
  timer ??= setTimeout(flush, FLUSH_MS);
}
