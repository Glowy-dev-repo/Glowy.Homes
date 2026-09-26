import { z } from "zod";
import { SearchParams } from "@/types/search";

import { ALERT_FREQUENCIES } from "./saved-search-constants";

export { ALERT_FREQUENCIES, ALERT_LABELS, type AlertFrequency } from "./saved-search-constants";

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
