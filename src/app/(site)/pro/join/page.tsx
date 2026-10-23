import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProSignupWizard } from "@/components/pro/ProSignupWizard";
import { sqlClient } from "@/db";
import { auth } from "@/lib/auth";
import { zipOptions } from "@/lib/zips";

export const metadata: Metadata = { title: "Become a partner agent", robots: { index: false }, alternates: { canonical: "/pro/join" } };

export default async function ProJoinPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin?callbackUrl=/pro/join");
  const [existing] = await sqlClient`select pro_type from pros where user_id = ${session.user.id}`;
  if (existing) redirect(existing.pro_type === "landlord" ? "/landlord" : "/pro/profile");
  const zips = await zipOptions();
  return (
    <div className="container-page py-10">
      <h1 className="mb-2 text-h1">Become a partner agent</h1>
      <p className="mb-8 text-body text-neutral-700">Choose the ZIP codes you serve. When someone asks about a home in one of them, the inquiry can come to you.</p>
      <ProSignupWizard zips={zips} defaultName={session.user.name ?? ""} />
    </div>
  );
}
