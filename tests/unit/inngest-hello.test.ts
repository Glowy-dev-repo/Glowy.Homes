import { describe, expect, it } from "vitest";
import { functions } from "@/inngest/functions";
import { greet } from "@/inngest/functions/hello";

describe("hello job", () => {
  it("greets by name and defaults to world", () => {
    expect(greet({ name: "Glowy" })).toEqual({ message: "Hello, Glowy" });
    expect(greet({})).toEqual({ message: "Hello, world" });
    expect(greet(undefined)).toEqual({ message: "Hello, world" });
  });

  it("rejects invalid input", () => {
    expect(() => greet({ name: "" })).toThrow();
  });

  it("is registered with the Inngest handler", () => {
    expect(functions.map((f) => f.id())).toContain("hello");
  });
});
