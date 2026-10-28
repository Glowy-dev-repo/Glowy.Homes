import { z } from "zod";
import type { ProStatus } from "@/db/schema/agents";

export const PRO_STATUS_ACTIONS = ["approve", "reject", "suspend", "reactivate"] as const;
export type ProStatusAction = (typeof PRO_STATUS_ACTIONS)[number];

// The only status changes an admin can make. Anything else is refused.
const TRANSITIONS: Record<ProStatus, Partial<Record<ProStatusAction, ProStatus>>> = {
  pending: { approve: "active", reject: "suspended" },
  active: { suspend: "suspended" },
  suspended: { reactivate: "active" },
};

export function nextProStatus(current: ProStatus, action: ProStatusAction): ProStatus | null {
  return TRANSITIONS[current]?.[action] ?? null;
}

/** Actions an admin can take on an agent in this status, for the admin agent page. */
export function allowedActions(current: ProStatus): ProStatusAction[] {
  return PRO_STATUS_ACTIONS.filter((a) => nextProStatus(current, a));
}

export const ProStatusChange = z
  .object({ action: z.enum(PRO_STATUS_ACTIONS), reason: z.string().trim().max(500).optional().transform((v) => v || null) })
  .refine((v) => (v.action !== "reject" && v.action !== "suspend") || !!v.reason, { message: "Give a reason. The agent sees it in their email.", path: ["reason"] });
