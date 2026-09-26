// Frequency windows for saved search alerts (docs/03 section 6). Pure, so the "exactly once per
// window" rule can be tested with a fixed clock.

import { market } from "@/config/market";

export type AlertFrequency = "instant" | "daily" | "weekly";

export const ALERT_TIMEZONE = market.timezone;
export const INSTANT_WINDOW_MINUTES = 5;
export const MAX_ALERT_CARDS = 10;

function localParts(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** ISO 8601 week number and week year for a calendar date. */
export function isoWeek(year: number, month: number, day: number): { year: number; week: number } {
  const d = new Date(Date.UTC(year, month - 1, day));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return { year: d.getUTCFullYear(), week: Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7) };
}

/**
 * The window a send belongs to. Two runs inside the same window produce the same key, and the
 * alert_sends unique constraint turns the second one into a no op.
 */
export function alertPeriodKey(frequency: AlertFrequency, now: Date, timeZone = ALERT_TIMEZONE): string {
  if (frequency === "instant") {
    const slot = Math.floor(now.getTime() / (INSTANT_WINDOW_MINUTES * 60_000));
    return `instant:${slot}`;
  }
  const { year, month, day } = localParts(now, timeZone);
  if (frequency === "daily") return `daily:${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const w = isoWeek(year, month, day);
  return `weekly:${w.year}-W${String(w.week).padStart(2, "0")}`;
}

export function alertSubject(count: number, searchName: string): string {
  return `${count} new ${count === 1 ? "home" : "homes"} in ${searchName}`;
}
