import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProSignupWizard } from "@/components/pro/ProSignupWizard";
import { sqlClient } from "@/db";
import { auth } from "@/lib/auth";
import { allRegions } from "@/lib/search/regions";

export const metadata: Metadata = { title: "Join as a pro", robots: { index: false }, alternates: { canonical: "/pro/join" } };

export default async function ProJoinPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin?callbackUrl=/pro/join");
  const [existing] = await sqlClient`select pro_type from pros where user_id = ${session.user.id}`;
  if (existing) redirect(existing.pro_type === "landlord" ? "/landlord" : "/pro/profile");
  const regions = await allRegions();
  const cityIds = new Map(regions.filter((r) => r.type === "city").map((r) => [r.slug, r.id]));
  const areas = regions.map((r) => ({ id: r.id, name: r.name, type: r.type, parentId: r.type === "neighborhood" ? (cityIds.get(r.parentSlug ?? "") ?? null) : null }));
  return (
    <div className="container-page py-10">
      <h1 className="mb-2 text-h1">Join as a pro</h1>
      <p className="mb-8 text-body text-neutral-700">Set up your profile to receive leads from people searching in your areas.</p>
      <ProSignupWizard areas={areas} defaultName={session.user.name ?? ""} />
    </div>
  );
}
