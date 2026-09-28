"use client";

import { UserRound } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

/**
 * Session aware part of the header. Client side so pages that include the header can stay
 * static or ISR instead of reading cookies on the server.
 */
export function HeaderAccount() {
  const { data, status } = useSession();
  const roles = data?.user?.roles ?? [];
  const isPro = roles.includes("agent");

  if (status === "loading") return <div className="h-11 w-40" aria-hidden />;

  return (
    <div className="flex items-center gap-2">
      {data?.user ? (
        <Button asChild variant="ghost">
          <Link href="/account">
            <UserRound aria-hidden />
            Account
          </Link>
        </Button>
      ) : (
        <Button asChild variant="ghost">
          <Link href="/signin">Sign in</Link>
        </Button>
      )}
      <Button asChild>
        {isPro ? <Link href="/pro/leads">My leads</Link> : <Link href="/pro">For agents</Link>}
      </Button>
    </div>
  );
}
