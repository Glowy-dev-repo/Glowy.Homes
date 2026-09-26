import type { Metadata } from "next";
import { SavedSearchList } from "@/components/account/SavedSearchList";
import { auth } from "@/lib/auth";
import { savedSearches } from "@/server/data/saved";

export const metadata: Metadata = { title: "Saved searches", robots: { index: false }, alternates: { canonical: "/account/searches" } };

export default async function SavedSearchesPage() {
  const session = await auth();
  const rows = await savedSearches(session!.user.id);
  return (
    <div>
      <h1 className="mb-6 text-h1">Saved searches</h1>
      <SavedSearchList initial={rows} />
    </div>
  );
}
