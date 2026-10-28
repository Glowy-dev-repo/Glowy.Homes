import { describe, expect, it } from "vitest";
import { profileChecklist } from "@/lib/pros/checklist";

const empty = { photoUrl: null, bio: null, phone: null, zipCodes: [], brokerageName: null };
const full = { photoUrl: "pros/p1/a", bio: "Ten years selling in Moorpark.", phone: "8055550100", zipCodes: ["93021"], brokerageName: "Keller Williams" };

describe("profileChecklist", () => {
  it("lists five things to finish on an empty profile, each linking to the profile page", () => {
    const items = profileChecklist(empty);
    expect(items.map((i) => i.key)).toEqual(["photo", "bio", "phone", "zips", "brokerage"]);
    expect(items.every((i) => !i.done && i.href === "/pro/profile")).toBe(true);
  });

  it("marks everything done on a full profile", () => {
    expect(profileChecklist(full).every((i) => i.done)).toBe(true);
  });

  it("treats a blank bio as not done", () => {
    expect(profileChecklist({ ...full, bio: "   " }).find((i) => i.key === "bio")?.done).toBe(false);
  });
});
