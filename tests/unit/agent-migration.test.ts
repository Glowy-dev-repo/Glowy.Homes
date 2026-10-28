import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const file = resolve(__dirname, "../../src/db/migrations/0011_agent_area.sql");

describe("0011_agent_area migration", () => {
  it("adds the agent area columns, the invites table and one active account per license", () => {
    const sql = readFileSync(file, "utf8");
    for (const part of ["pros_agent_license_key", "status\" <> 'suspended'", "pro_invites", "close_price", "close_date", "agreement_version", "status_log"]) {
      expect(sql).toContain(part);
    }
  });

  it("suspends duplicate licenses before it creates the unique index", () => {
    const sql = readFileSync(file, "utf8");
    const fix = sql.indexOf("update pros set status = 'suspended'");
    const index = sql.indexOf('CREATE UNIQUE INDEX "pros_agent_license_key"');
    expect(fix).toBeGreaterThan(-1);
    expect(index).toBeGreaterThan(fix);
  });
});

describe("0011_agent_area duplicate license cleanup", () => {
  const sql = readFileSync(file, "utf8");

  it("keeps the active agent when duplicates exist, oldest first among equals", () => {
    expect(sql).toContain("order by (status = 'active') desc, created_at, id");
  });

  it("only treats real 8 digit DRE numbers as duplicates, and indexes only those", () => {
    expect(sql).toMatch(/license_number ~ '\^\[0-9\]\{8\}\$'\s*\) d where n > 1/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX "pros_agent_license_key"[^;]*license_number" ~ '\^\[0-9\]\{8\}\$'/);
  });
});
