import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => {
  const sql = Object.assign(() => Promise.resolve([]), {});
  return { sqlClient: sql };
});

const { AgentFilters, LeadFilters } = await import("@/server/data/admin-directory");

describe("admin list filters from the URL", () => {
  it("keep valid lead filters", () => {
    expect(LeadFilters.parse({ status: "new", source: "idx", zip: "93021", q: " dana ", page: "3" })).toEqual({
      status: "new",
      source: "idx",
      zip: "93021",
      q: "dana",
      page: 3,
    });
  });

  it("drop anything unexpected instead of failing the page", () => {
    expect(LeadFilters.parse({ status: "deleted", source: "zillow", zip: "9302", page: "-2" })).toEqual({
      status: undefined,
      source: undefined,
      zip: undefined,
      q: undefined,
      page: 1,
    });
    expect(LeadFilters.parse({}).page).toBe(1);
    expect(AgentFilters.parse({ status: "admin", page: "x" })).toMatchObject({ status: undefined, page: 1 });
    expect(AgentFilters.parse({ status: "pending", q: "93021" })).toMatchObject({ status: "pending", q: "93021", page: 1 });
  });
});
