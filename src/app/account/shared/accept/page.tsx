import type { Metadata } from "next";
import Link from "next/link";
import { AcceptShareButton } from "@/components/account/AcceptShareButton";
import { auth } from "@/lib/auth";
import { inviteByToken } from "@/server/data/shares";

export const metadata: Metadata = { title: "Accept shared list", robots: { index: false }, alternates: { canonical: "/account/shared/accept" } };

export default async function AcceptSharePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const [session, invite] = await Promise.all([auth(), token ? inviteByToken(token) : null]);
  if (!invite) {
    return (
      <div>
        <h1 className="mb-3 text-h1">Shared list</h1>
        <p className="text-body text-neutral-700">This invitation has expired or was already used. Ask for a new one.</p>
        <Link href="/account/shared" className="mt-6 inline-flex min-h-11 items-center font-medium text-accent hover:underline">Go to your shared list</Link>
      </div>
    );
  }
  const email = session!.user.email?.toLowerCase();
  return (
    <div className="max-w-xl">
      <h1 className="mb-3 text-h1">Join {invite.inviterName}&apos;s shared list</h1>
      {email === invite.inviteeEmail ? (
        <>
          <p className="mb-6 text-body text-neutral-700">You will see the homes {invite.inviterName} saves, and they will see yours. Either of you can stop sharing at any time.</p>
          <AcceptShareButton token={token} />
        </>
      ) : (
        <p className="text-body text-neutral-700">This invitation was sent to {invite.inviteeEmail}. Sign out and sign in with that email to accept it.</p>
      )}
    </div>
  );
}
