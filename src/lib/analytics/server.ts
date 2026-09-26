import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { sqlClient } from "@/db";
import { ANON_COOKIE, type EventInput } from "./events";

/** The visitor's anonymous id cookie (set by /api/events), shared by client and server events. */
export async function anonId(): Promise<string | null> {
  return (await cookies()).get(ANON_COOKIE)?.value ?? null;
}

export function newAnonId(): string {
  return randomUUID();
}

export async function insertEvents(userId: string | null, anon: string | null, events: EventInput[]) {
  if (!events.length) return;
  const now = Date.now();
  const rows = events.map((e) => ({
    user_id: userId,
    anon_id: anon,
    name: e.name,
    props: e.props ?? {},
    // Client clocks drift: trust them only within a day, otherwise use server time.
    created_at: new Date(e.at && Math.abs(now - e.at) < 86_400_000 ? e.at : now).toISOString(),
  }));
  await sqlClient`
    insert into events (user_id, anon_id, name, props, created_at)
    select x.user_id, x.anon_id, x.name, x.props, x.created_at
    from jsonb_to_recordset(${sqlClient.json(rows as never)}) as x(user_id uuid, anon_id text, name text, props jsonb, created_at timestamptz)`;
}

/** Server side events (for example lead_submit), attributed to the current visitor. Never throws. */
export async function trackServer(name: EventInput["name"], props: EventInput["props"], userId: string | null) {
  try {
    await insertEvents(userId, await anonId(), [{ name, props }]);
  } catch (e) {
    console.warn("[analytics] event dropped", e);
  }
}
