import type { Metadata } from "next";
import { ApplicationForm } from "@/components/rentals/ApplicationForm";
import { auth } from "@/lib/auth";
import { myApplication } from "@/server/data/rentals";

export const metadata: Metadata = { title: "Rental application", robots: { index: false }, alternates: { canonical: "/account/application" } };

export default async function ApplicationPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await auth();
  const app = await myApplication(session!.user.id);
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
  return (
    <div>
      <h1 className="mb-2 text-h1">Your rental application</h1>
      <p className="mb-6 text-body text-neutral-700">Fill this out once and send it to any rental on the site.</p>
      <ApplicationForm initial={app?.profile ?? null} email={session!.user.email ?? ""} next={safeNext} />
    </div>
  );
}
