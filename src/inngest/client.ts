import { Inngest } from "inngest";

const signingKey = process.env.INNGEST_SIGNING_KEY;
const hasCloudKeys = !!signingKey && !signingKey.includes("replace");

// Without real Inngest Cloud keys we run in dev mode, talking to the local dev server
// (npm run inngest:dev). With keys (Vercel), requests are signed and verified.
export const inngest = new Inngest({ id: "glowy-homes", isDev: !hasCloudKeys });
