import { inngest } from "../src/inngest/client";

// Sends app/hello to the Inngest dev server and waits for the run to complete.
// Needs `npm run dev` and `npm run inngest:dev` running.
const DEV_SERVER = process.env.INNGEST_BASE_URL ?? "http://localhost:8288";

const { ids } = await inngest.send({ name: "app/hello", data: { name: "smoke test" } });
const eventId = ids[0];
console.log(`sent app/hello, event ${eventId}`);

type Run = { status: string; output?: unknown };
const deadline = Date.now() + 60_000;
while (Date.now() < deadline) {
  const res = await fetch(`${DEV_SERVER}/v1/events/${eventId}/runs`);
  if (res.ok) {
    const { data } = (await res.json()) as { data: Run[] };
    const run = data[0];
    if (run?.status === "Completed") {
      console.log("run completed with output", JSON.stringify(run.output));
      process.exit(0);
    }
    if (run && ["Failed", "Cancelled"].includes(run.status)) {
      console.error(`run ${run.status}`);
      process.exit(1);
    }
  }
  await new Promise((r) => setTimeout(r, 1000));
}
console.error("timed out waiting for the hello run");
process.exit(1);
