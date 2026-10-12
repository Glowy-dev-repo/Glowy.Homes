import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ sqlClient: () => Promise.resolve([]) }));

const { claimMode } = await import("@/server/data/owner");

describe("home claim verification mode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is instant in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CLAIM_VERIFICATION", "");
    expect(claimMode()).toBe("instant");
  });

  it("goes to admin review in production, so nobody can claim a home with a code sent to themselves", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CLAIM_VERIFICATION", "");
    expect(claimMode()).toBe("review");
  });

  it("follows an explicit setting", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CLAIM_VERIFICATION", "code");
    expect(claimMode()).toBe("code");
  });
});
