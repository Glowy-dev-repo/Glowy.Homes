import { afterEach, describe, expect, it } from "vitest";
import { isPreviewExempt, previewPassword, previewToken, safeNext, sameString } from "@/lib/preview";

describe("private preview", () => {
  const saved = process.env.PREVIEW_PASSWORD;
  afterEach(() => {
    if (saved === undefined) delete process.env.PREVIEW_PASSWORD;
    else process.env.PREVIEW_PASSWORD = saved;
  });

  it("is off unless a real password is set", () => {
    delete process.env.PREVIEW_PASSWORD;
    expect(previewPassword()).toBeNull();
    process.env.PREVIEW_PASSWORD = "  ";
    expect(previewPassword()).toBeNull();
    process.env.PREVIEW_PASSWORD = "replace_me";
    expect(previewPassword()).toBeNull();
    process.env.PREVIEW_PASSWORD = "harbor lights 42";
    expect(previewPassword()).toBe("harbor lights 42");
  });

  it("derives a stable token that changes with the password", async () => {
    const a = await previewToken("one");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await previewToken("one")).toBe(a);
    expect(await previewToken("two")).not.toBe(a);
    expect(sameString(a, a)).toBe(true);
    expect(sameString(a, `${a.slice(0, -1)}0`)).toBe(a.endsWith("0"));
    expect(sameString("short", "longer")).toBe(false);
  });

  it("leaves the password page, health check and background jobs open", () => {
    expect(isPreviewExempt("/preview")).toBe(true);
    expect(isPreviewExempt("/api/preview")).toBe(true);
    expect(isPreviewExempt("/api/health")).toBe(true);
    expect(isPreviewExempt("/api/inngest")).toBe(true);
    expect(isPreviewExempt("/")).toBe(false);
    expect(isPreviewExempt("/previews")).toBe(false);
    expect(isPreviewExempt("/api/search")).toBe(false);
  });

  it("only returns to paths on this site", () => {
    expect(safeNext("/search?city=los-angeles")).toBe("/search?city=los-angeles");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext(undefined)).toBe("/");
  });
});
