import type { Metadata } from "next";
import { SharedList } from "@/components/account/SharedList";
import { auth } from "@/lib/auth";
import { sharedHomes, shares } from "@/server/data/shares";

export const metadata: Metadata = { title: "Shared list", robots: { index: false }, alternates: { canonical: "/account/shared" } };

export default async function SharedPage() {
  const session = await auth();
  const [rows, homes] = await Promise.all([shares(session!.user.id), sharedHomes(session!.user.id)]);
  return (
    <div>
      <h1 className="mb-2 text-h1">Shared list</h1>
      <p className="mb-6 max-w-2xl text-body text-neutral-700">Share saved homes with a partner or cobuyer. You each keep saving as usual, and this list shows both.</p>
      <SharedList shares={rows} homes={homes} />
    </div>
  );
}
