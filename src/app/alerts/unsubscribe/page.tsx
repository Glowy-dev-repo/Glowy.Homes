import type { Metadata } from "next";
import Link from "next/link";
import { UnsubscribeButton } from "@/components/account/UnsubscribeButton";
import { sqlClient } from "@/db";
import { verifyUnsubscribeToken } from "@/lib/alerts/token";
import { isUuid } from "@/lib/listings/detail";

export const metadata: Metadata = { title: "Stop search alerts", robots: { index: false }, alternates: { canonical: "/alerts/unsubscribe" } };
export const dynamic = "force-dynamic";

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ id?: string; token?: string }> }) {
  const { id = "", token = "" } = await searchParams;
  const valid = isUuid(id) && verifyUnsubscribeToken(id, token);
  const [search] = valid ? await sqlClient<{ name: string; frequency: string }[]>`select name, alert_frequency as frequency from saved_searches where id = ${id}` : [];
  return (
    <div className="container-page max-w-xl py-16">
      <h1 className="mb-3 text-h1">Stop search alerts</h1>
      {search ? (
        search.frequency === "off" ? (
          <p className="text-body text-neutral-700" role="status">Alerts for {search.name} are already off.</p>
        ) : (
          <>
            <p className="mb-6 text-body text-neutral-700">You will no longer get emails about new homes for {search.name}. The search stays saved in your account.</p>
            <UnsubscribeButton id={id} token={token} />
          </>
        )
      ) : (
        <p className="text-body text-neutral-700">This link is not valid anymore. You can manage alerts from your saved searches.</p>
      )}
      <p className="mt-8">
        <Link href="/account/searches" className="inline-flex min-h-11 items-center font-medium text-accent hover:underline">Manage saved searches</Link>
      </p>
    </div>
  );
}
