"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useEffect, useState } from "react";
import { SavedHomesProvider } from "@/components/listing/saved-homes";
import { RecentlyViewedSync } from "@/components/listing/RecentlyViewedSync";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 } } }),
  );

  // Marks the document once React has hydrated; e2e tests wait for it before interacting.
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <SavedHomesProvider>
          <RecentlyViewedSync />
          {children}
        </SavedHomesProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
