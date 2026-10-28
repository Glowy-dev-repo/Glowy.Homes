import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProProfileForm } from "@/components/pro/ProProfileForm";
import { auth } from "@/lib/auth";
import { zipOptions } from "@/lib/zips";
import { proForEdit } from "@/server/data/pros";

export const metadata: Metadata = { title: "Your profile", robots: { index: false }, alternates: { canonical: "/pro/profile" } };

export default async function ProProfilePage() {
  const session = await auth();
  const pro = await proForEdit(session!.user.id);
  if (!pro) redirect("/pro/join");
  const zips = await zipOptions();

  return (
    <div>
      <h1 className="mb-6 text-h1">Your profile</h1>
      <ProProfileForm initial={pro} zips={zips} />
    </div>
  );
}
