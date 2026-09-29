import { Inngest } from "inngest";

// Dev mode talks to the local dev server (npm run inngest:dev) and skips request signing, so it must
// never switch on by itself in production: only outside production, or when INNGEST_DEV=1 is set on
// purpose (the local phase gate). In production without keys, /api/inngest rejects unsigned calls and
// sending events fails; lead creation already tolerates that and the admin sees unassigned leads.
const devMode = process.env.INNGEST_DEV === "1" || process.env.NODE_ENV !== "production";

export const inngest = new Inngest({ id: "glowy-homes", isDev: devMode });
