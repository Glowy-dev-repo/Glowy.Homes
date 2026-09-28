import type { Role } from "@/db/schema/users";

export type Access = "allow" | "signin" | "forbidden";

type Rule = { match: (path: string) => boolean; roles: readonly Role[] | "any" };

const under = (prefix: string) => (path: string) => path === prefix || path.startsWith(`${prefix}/`);

// /pro itself is the public pro landing page (docs/01 route map); everything below it is the pro workspace.
const RULES: Rule[] = [
  { match: under("/admin"), roles: ["admin"] },
  // Any signed in user can apply to become a pro.
  { match: under("/pro/join"), roles: "any" },
  { match: (p) => p.startsWith("/pro/"), roles: ["agent", "admin"] },
  { match: under("/landlord"), roles: "any" },
  { match: under("/account"), roles: "any" },
];

/** Decides whether a request to `path` may proceed. Edge safe: no database access. */
export function accessFor(path: string, roles: readonly Role[] | null): Access {
  const rule = RULES.find((r) => r.match(path));
  if (!rule) return "allow";
  if (!roles) return "signin";
  if (rule.roles === "any") return "allow";
  return rule.roles.some((r) => roles.includes(r)) ? "allow" : "forbidden";
}
