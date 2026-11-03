import { revalidatePath } from "next/cache";

/**
 * Revalidates a public page by its route pattern (for example "/agents/[city]"). Public pages live in
 * the (site) route group, and Next.js matches page patterns including the group, so both forms are
 * revalidated: the grouped one is what applies today, the plain one keeps working if the group moves.
 *
 * Called after a change is saved: if the cache cannot be refreshed (no request in progress, as in a script),
 * the change still stands and the page refreshes on its own schedule, so this warns instead of throwing.
 */
export function revalidateSitePage(route: string, type: "page" | "layout" = "page") {
  try {
    revalidatePath(route, type);
    revalidatePath(route === "/" ? "/(site)" : `/(site)${route}`, type);
  } catch (e) {
    console.warn(`[revalidate] ${route}: ${e instanceof Error ? e.message : String(e)}`);
  }
}
