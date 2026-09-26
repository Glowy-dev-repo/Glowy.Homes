"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { ALERT_FREQUENCIES } from "@/lib/saved-search-schema";

export type SettingsValues = { name: string; phone: string; savedSearchDefault: string; marketing: boolean };
/** values echo what was submitted: React 19 resets form fields after an action, and the form re-seeds from them. */
export type SettingsState = { status: "idle" | "saved" | "error"; message?: string; fields?: Record<string, string>; values?: SettingsValues };

// Not exported: a "use server" module may only export async functions.
const SettingsInput = z.object({
  name: z.string().trim().max(80, "Use 80 characters or fewer.").optional().transform((v) => v || null),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/[^\d+]/g, "") : null))
    .refine((v) => v === null || /^\+?\d{10,15}$/.test(v), "Enter a phone number with area code, like 416 555 0100."),
  savedSearchDefault: z.enum(ALERT_FREQUENCIES),
  marketing: z.boolean(),
});

export async function updateSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const session = await auth();
  if (!session?.user?.id) return { status: "error", message: "Sign in again to change settings." };

  const values: SettingsValues = {
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    savedSearchDefault: String(formData.get("savedSearchDefault") ?? "daily"),
    marketing: formData.get("marketing") === "on",
  };
  const parsed = SettingsInput.safeParse(values);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message;
    return { status: "error", message: "Check the highlighted fields.", fields, values };
  }

  await db
    .update(users)
    .set({
      name: parsed.data.name,
      phone: parsed.data.phone,
      notificationPrefs: { saved_search: parsed.data.savedSearchDefault, marketing: parsed.data.marketing },
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));
  revalidatePath("/account/settings");
  return { status: "saved", message: "Settings saved.", values };
}
