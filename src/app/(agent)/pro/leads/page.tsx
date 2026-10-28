import type { Metadata } from "next";
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
    <div>
      <h1 className="mb-6 text-h1">Leads</h1>
      {pro.status === "active" ? (
        <LeadInbox initialOpenId={lead} />
      ) : (
        <p className="text-body text-neutral-700">Leads Glowy Homes assigns to you appear here once your account is active.</p>
      )}
    </div>
  );
}
