import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { devMailFile, sendEmail } from "@/lib/email";
import { magicLinkEmail } from "@/lib/email/templates/magic-link";

describe("email", () => {
  it("magic link email escapes the URL and has no dashes in copy", () => {
    const { html, text, subject } = magicLinkEmail('https://x.test/cb?a=1&b="2"');
    expect(html).toContain("a=1&amp;b=&quot;2&quot;");
    expect(text).toContain("https://x.test/cb");
    for (const copy of [subject, text]) expect(copy).not.toMatch(/[–—]| - /);
  });

  it("log transport writes the latest email per recipient", async () => {
    const to = `unit-${Date.now()}@example.com`;
    await sendEmail({ to, subject: "s", html: "<p>h</p>", text: "t", link: "https://x.test/l" });
    const saved = JSON.parse(readFileSync(devMailFile(to), "utf8"));
    expect(saved.link).toBe("https://x.test/l");
  });
});
