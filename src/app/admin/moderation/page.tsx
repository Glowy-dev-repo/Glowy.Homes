import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/AdminPage";
import { ModerationQueue } from "@/components/admin/ModerationQueue";
import { moderationQueue } from "@/server/data/admin";

export const metadata: Metadata = { title: "Approvals", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ModerationPage() {
  const items = await moderationQueue();
  return (
    <div>
      <AdminHeader
        title="Approvals"
        description="New partner agents, listings posted by owners and landlords, home claims and reviews wait here until you approve or reject them. Oldest first, urgent items on top."
      />
      <ModerationQueue items={items} />
    </div>
  );
}
