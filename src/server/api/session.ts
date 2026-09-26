import "server-only";
import { auth } from "@/lib/auth";

/** The signed in user's id for route handlers, or null. Ownership checks always use this, never client input. */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
