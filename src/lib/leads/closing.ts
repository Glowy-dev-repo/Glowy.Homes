import { z } from "zod";
import { market } from "@/config/market";
import { LEAD_STATUSES } from "@/db/schema/leads";

/** Today's date in the market's time zone, as YYYY-MM-DD. */
const todayInMarket = () => new Intl.DateTimeFormat("en-CA", { timeZone: market.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/**
 * An agent's change to their lead (PATCH /api/pro/leads/[id]): a status, a note, or both. Closing a lead
 * needs the sale price and closing date, which Glowy Homes uses for the agent's referral statement.
 */
export const LeadPatch = z
  .object({
    status: z.enum(LEAD_STATUSES).exclude(["unassigned"]).optional(),
    note: z.string().trim().min(1).max(2000).optional(),
    closePrice: z.number({ message: "Enter the sale price." }).int().min(1000, "Enter the sale price in dollars.").max(100_000_000).optional(),
    closeDate: z.iso.date("Enter the closing date.").optional(),
  })
  .refine((v) => v.status || v.note, "Change the status or add a note.")
  .superRefine((v, ctx) => {
    if (v.status === "closed") {
      if (v.closePrice === undefined) ctx.addIssue({ code: "custom", path: ["closePrice"], message: "Enter the sale price." });
      if (v.closeDate === undefined) ctx.addIssue({ code: "custom", path: ["closeDate"], message: "Enter the closing date." });
      else if (v.closeDate > todayInMarket()) ctx.addIssue({ code: "custom", path: ["closeDate"], message: "The closing date cannot be in the future." });
    } else if (v.closePrice !== undefined || v.closeDate !== undefined) {
      ctx.addIssue({ code: "custom", path: ["closePrice"], message: "Sale details go with the Closed status." });
    }
  });
export type LeadPatch = z.infer<typeof LeadPatch>;

/** A typed dollar amount ("$1,250,000", "450000.00") in whole dollars, or null if it is not one. */
export function parseDollars(input: string): number | null {
  const v = input.trim();
  if (!/^\$?(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/.test(v)) return null;
  return Math.round(Number(v.replace(/[$,]/g, "")));
}
