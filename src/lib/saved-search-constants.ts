// Client safe alert settings, without zod, so the save search dialog stays light.

export const ALERT_FREQUENCIES = ["instant", "daily", "weekly", "off"] as const;
export type AlertFrequency = (typeof ALERT_FREQUENCIES)[number];

export const ALERT_LABELS: Record<AlertFrequency, string> = {
  instant: "Instantly",
  daily: "Daily",
  weekly: "Weekly",
  off: "No emails",
};
