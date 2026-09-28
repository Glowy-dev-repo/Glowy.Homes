import "server-only";
import { auth } from "@/lib/auth";
import { proForUser, type ProContext } from "@/server/data/pro-leads";
import { fail, unauthorized } from "./respond";

/** Resolves the signed in user's pro profile, or an error response for route handlers. */
export async function requirePro(): Promise<{ userId: string; pro: ProContext } | { response: Response }> {
  const session = await auth();
  if (!session?.user?.id) return { response: unauthorized() };
  const pro = await proForUser(session.user.id);
  if (!pro) return { response: fail(403, { code: "not_a_pro", message: "This area is for partner agents and landlords." }) };
  return { userId: session.user.id, pro };
}

export async function requireAdmin(): Promise<{ userId: string } | { response: Response }> {
  const session = await auth();
  if (!session?.user?.id) return { response: unauthorized() };
  // Checked again here, not only in middleware (docs/02 section 8.5).
  if (!session.user.roles?.includes("admin")) return { response: fail(403, { code: "forbidden", message: "Admins only." }) };
  return { userId: session.user.id };
}
