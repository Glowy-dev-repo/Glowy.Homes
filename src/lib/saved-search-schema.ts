import { z } from "zod";
import { SearchParams } from "@/types/search";

export const ALERT_FREQUENCIES = ["instant", "daily", "weekly", "off"] as const;
export type AlertFrequency = (typeof ALERT_FREQUENCIES)[number];

export const ALERT_LABELS: Record<AlertFrequency, string> = {
  instant: "Instantly",
  daily: "Daily",
  weekly: "Weekly",
  off: "No emails",
};

export const CreateSavedSearch = z.object({
  name: z.string().trim().min(1, "Give this search a name.").max(80),
  filters: SearchParams,
  alertFrequency: z.enum(ALERT_FREQUENCIES).default("daily"),
});

export const UpdateSavedSearch = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    alertFrequency: z.enum(ALERT_FREQUENCIES).optional(),
  })
  .refine((v) => v.name !== undefined || v.alertFrequency !== undefined, "Nothing to update.");
