import { z } from "zod";
import { inngest } from "../client";

export const HelloEvent = z.object({ name: z.string().min(1).max(80).default("world") });

export function greet(input: unknown): { message: string } {
  const { name } = HelloEvent.parse(input ?? {});
  return { message: `Hello, ${name}` };
}

/** Smoke test job proving the Inngest wiring works end to end. */
export const hello = inngest.createFunction(
  { id: "hello", triggers: [{ event: "app/hello" }] },
  async ({ event, step }) => step.run("greet", () => greet(event.data)),
);
