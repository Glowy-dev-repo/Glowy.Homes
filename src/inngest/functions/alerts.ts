import { sendDueAlerts } from "@/lib/alerts/send";
import type { AlertFrequency } from "@/lib/alerts/window";
import { inngest } from "../client";
import { market } from "@/config/market";

// send_saved_search_alerts (docs/03 section 6): instant every 5 minutes, daily at 08:00 and weekly
// on Monday at 08:00, both in the market's timezone. Safe to rerun: sends are keyed by window.

function alertsFn(frequency: AlertFrequency, cron: string) {
  return inngest.createFunction(
    { id: `send-saved-search-alerts-${frequency}`, concurrency: { limit: 1 }, triggers: [{ cron }, { event: `alerts/${frequency}.requested` }] },
    async ({ step }) => step.run("send", () => sendDueAlerts(frequency)),
  );
}

export const instantAlertsFn = alertsFn("instant", "*/5 * * * *");
export const dailyAlertsFn = alertsFn("daily", `TZ=${market.timezone} 0 8 * * *`);
export const weeklyAlertsFn = alertsFn("weekly", `TZ=${market.timezone} 0 8 * * 1`);
