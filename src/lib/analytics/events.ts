import { z } from "zod";

// Analytics events (docs/03 section 8). Client safe: the tracker and /api/events share it.

export const EVENT_NAMES = [
  "page_view",
  "search",
  "listing_view",
  "photo_gallery_open",
  "save_home",
  "save_search",
  "estimate_view",
  "claim_home",
  "lead_submit",
  "lead_status_change",
  "signup",
  "login",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

/** Props are small flat values: ids, slugs, types. Never names, emails or free text. */
const Prop = z.union([z.string().max(200), z.number(), z.boolean(), z.null()]);
/**
 * Events a browser may report. The rest (lead_submit, signup, login, claim_home, lead_status_change) are
 * recorded only by the server, so nobody can inflate the admin funnel or lead numbers from outside.
 */
export const CLIENT_EVENT_NAMES = ["page_view", "search", "listing_view", "photo_gallery_open", "save_home", "save_search", "estimate_view"] as const satisfies readonly EventName[];

export const EventInput = z.object({
  name: z.enum(EVENT_NAMES),
  props: z.record(z.string().max(40), Prop).refine((p) => Object.keys(p).length <= 12, "Too many props").default({}),
  at: z.number().int().optional(),
});
export const EventBatch = z.object({ events: z.array(EventInput).min(1).max(50) });
/** What POST /api/events accepts: browser events only. */
export const ClientEventBatch = z.object({
  events: z.array(EventInput.extend({ name: z.enum(CLIENT_EVENT_NAMES) })).min(1).max(50),
});
export type EventInput = z.input<typeof EventInput>;

export const ANON_COOKIE = "gh_aid";
