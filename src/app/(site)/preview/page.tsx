import type { Metadata } from "next";
import { PreviewForm } from "@/components/preview/PreviewForm";
import { brand } from "@/config/brand";
import { safeNext } from "@/lib/preview";

export const metadata: Metadata = {
  title: "Private preview",
  description: `${brand.name} is in private preview.`,
  alternates: { canonical: "/preview" },
  robots: { index: false, follow: false },
};

export default async function PreviewPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="container-page flex justify-center py-12 md:py-20">
      <div className="w-full max-w-sm">
        <h1 className="text-h1">Private preview</h1>
        <p className="mt-2 text-body text-neutral-600">
          {brand.name} is not open to the public yet. Enter the password you were given to view the site.
        </p>
        <div className="mt-6">
          <PreviewForm next={safeNext(next)} />
        </div>
      </div>
    </div>
  );
}
