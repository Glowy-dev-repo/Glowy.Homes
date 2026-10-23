import { revalidatePath } from "next/cache";

/**
 * Revalidates a public page by its route pattern (for example "/agents/[city]"). Public pages live in
 * the (site) route group, and Next.js matches page patterns including the group, so both forms are
 * revalidated: the grouped one is what applies today, the plain one keeps working if the group moves.
 */
export function revalidateSitePage(route: string, type: "page" | "layout" = "page") {
  revalidatePath(route, type);
  revalidatePath(route === "/" ? "/(site)" : `/(site)${route}`, type);
}
