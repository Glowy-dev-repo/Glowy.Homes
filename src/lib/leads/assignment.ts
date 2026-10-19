// Who chooses the agent for a new lead. Glowy Homes earns from its partner agents (subscription or
// commission), so by default every lead waits for an admin, who picks the agent; routing still works
// out the best match for the ZIP code and shows it as the suggestion. LEAD_ASSIGNMENT=auto assigns
// that match straight away instead (docs/03 section 5 behavior).

export type LeadAssignmentMode = "admin" | "auto";

export function leadAssignmentMode(): LeadAssignmentMode {
  return process.env.LEAD_ASSIGNMENT?.trim().toLowerCase() === "auto" ? "auto" : "admin";
}
