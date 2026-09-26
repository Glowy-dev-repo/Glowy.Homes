import { expect, test } from "@playwright/test";

test("Inngest handler is mounted and exposes the hello function", async ({ request }) => {
  const res = await request.get("/api/inngest");
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { function_count?: number };
  expect(body.function_count).toBeGreaterThanOrEqual(1);
});
