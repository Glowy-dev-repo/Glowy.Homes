import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { SettingsForm } from "@/components/account/SettingsForm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings", robots: { index: false }, alternates: { canonical: "/account/settings" } };

export default async function SettingsPage() {
  const session = await auth();
  const user = await db.query.users.findFirst({ where: eq(users.id, session!.user.id) });
  if (!user) return null;
  return (
    <div>
      <h1 className="mb-6 text-h1">Settings</h1>
      <SettingsForm
        initial={{
          email: user.email,
          name: user.name,
          phone: user.phone,
          savedSearchDefault: user.notificationPrefs.saved_search,
          marketing: user.notificationPrefs.marketing,
        }}
      />
    </div>
  );
}
