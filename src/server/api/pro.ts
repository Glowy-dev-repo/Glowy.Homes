import "server-only";
import { sqlClient } from "@/db";
import { auth } from "@/lib/auth";
import { proForUser, type ProContext } from "@/server/data/pro-leads";
import { fail, unauthorized } from "./respond";

/**
 * Resolves the signed in user's pro profile, or an error response for route handlers. Lead data is only
 * for active pros: a pending (not yet verified) or suspended pro can still edit their profile
 * (`allowInactive`), but cannot read or work leads.
 */
export async function requirePro(opts: { allowInactive?: boolean } = {}): Promise<{ userId: string; pro: ProContext } | { response: Response }> {
  const session = await auth();
  if (!session?.user?.id) return { response: unauthorized() };
  const pro = await proForUser(session.user.id);
  if (!pro) return { response: fail(403, { code: "not_a_pro", message: "This area is for partner agents and landlords." }) };
  if (pro.status !== "active" && !opts.allowInactive) {
    return { response: fail(403, { code: "not_active", message: "Leads start once your profile is approved." }) };
  }
  return { userId: session.user.id, pro };
}

/** Admin rights come from the database on every call, so removing the role takes effect at once. */
export async function isAdmin(userId: string): Promise<boolean> {
  const [u] = await sqlClient<{ admin: boolean }[]>`select 'admin' = any(roles) as admin from users where id = ${userId}`;
  return !!u?.admin;
}

export async function requireAdmin(): Promise<{ userId: string } | { response: Response }> {
  const session = await auth();
  if (!session?.user?.id) return { response: unauthorized() };
  // Checked again here, not only in middleware (docs/02 section 8.5), and against the database: the
  // role in the session cookie can be up to 30 days old.
  if (!session.user.roles?.includes("admin") || !(await isAdmin(session.user.id))) {
    return { response: fail(403, { code: "forbidden", message: "Admins only." }) };
  }
  return { userId: session.user.id };
}
