import { z } from "zod";

/** Admin invites an agent by email. The invite only sends the email: the agent still applies and is approved. */
export const AgentInvite = z.object({
  email: z.string().trim().toLowerCase().max(254).email("Enter the agent's email address."),
  name: z.string().trim().max(80).optional().transform((v) => v || undefined),
});
export type AgentInvite = z.infer<typeof AgentInvite>;
