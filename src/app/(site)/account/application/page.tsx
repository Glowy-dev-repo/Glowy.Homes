import type { Metadata } from "next";
import { ApplicationForm } from "@/components/rentals/ApplicationForm";
import { auth } from "@/lib/auth";
import { safeNext } from "@/lib/preview";
import { myApplication } from "@/server/data/rentals";

export const metadata: Metadata = { title: "Rental application", robots: { index: false }, alternates: { canonical: "/account/application" } };

export default async function ApplicationPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await auth();
  const app = await myApplication(session!.user.id);
  const { next } = await searchParams;
  // Same site paths only ("/\evil.com" is read by browsers as another site).
  const back = next ? safeNext(next) : undefined;
  return (
    <div>
      <h1 className="mb-2 text-h1">Your rental application</h1>
      <p className="mb-6 text-body text-neutral-700">Fill this out once and send it to any rental on the site.</p>
      <ApplicationForm initial={app?.profile ?? null} email={session!.user.email ?? ""} next={back} />
    </div>
  );
}
