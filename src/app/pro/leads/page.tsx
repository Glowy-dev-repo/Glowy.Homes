import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LeadInbox } from "@/components/pro/LeadInbox";
import { auth } from "@/lib/auth";
import { proForUser } from "@/server/data/pro-leads";

export const metadata: Metadata = { title: "Leads", robots: { index: false }, alternates: { canonical: "/pro/leads" } };

export default async function ProLeadsPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const session = await auth();
  const pro = await proForUser(session!.user.id);
  if (!pro) redirect("/pro/join");
  const { lead } = await searchParams;
  return (
    <div className="container-page py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1">Leads</h1>
        <nav aria-label="Pro" className="flex gap-4 text-body">
          <Link href="/pro/listings" className="font-medium text-accent hover:underline">Listings</Link>
          <Link href="/pro/profile" className="font-medium text-accent hover:underline">Profile</Link>
        </nav>
      </div>
      {pro.status !== "active" && (
        <p role="status" className="mb-6 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-body">
          Your profile is {pro.status}. Leads start once your licence is verified.
        </p>
      )}
      <LeadInbox initialOpenId={lead} />
    </div>
  );
}
