"use client";

import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  // Marks the document once React has hydrated; e2e tests wait for it before interacting.
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);

  return <SessionProvider>{children}</SessionProvider>;
}
