import type { Metadata } from "next";
import { SavedHomesList } from "@/components/account/SavedHomesList";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { signOutAction } from "@/server/actions/auth";
import { savedHomes } from "@/server/data/saved";

export const metadata: Metadata = {
  title: "Saved homes",
  description: "Homes you saved.",
  alternates: { canonical: "/account" },
  robots: { index: false },
};

export default async function SavedHomesPage() {
  const session = await auth();
  const homes = await savedHomes(session!.user.id);
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1">Saved homes</h1>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost">
            Sign out
          </Button>
        </form>
      </div>
      <SavedHomesList initial={homes} />
    </div>
  );
}
