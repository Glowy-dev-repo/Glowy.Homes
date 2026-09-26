import type { Metadata } from "next";
import { ModerationQueue } from "@/components/admin/ModerationQueue";
import { moderationQueue } from "@/server/data/admin";

export const metadata: Metadata = { title: "Moderation", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ModerationPage() {
  const items = await moderationQueue();
  return (
    <div>
      <h1 className="mb-6 text-h1">Moderation queue</h1>
      <ModerationQueue items={items} />
    </div>
  );
}
