"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";

/**
 * The shared React Query client, and the adapter the shell's URL state reads from.
 *
 * Built in `useState` rather than at module scope on purpose: a module-scope
 * client is created once per server process and then shared by every request
 * that renders on it, so one user's cached data can be served to another. One
 * client per browser session is the correct lifetime.
 *
 * `NuqsAdapter` is not optional decoration. The shell mirrors the view, the
 * section and which panels are open into the query string, and a panel's own
 * filter chips live there too — so without the adapter every panel that reads a
 * filter throws NUQS-404 rather than quietly rendering an unfiltered list.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Bills, payouts and attestations all move on their own schedule.
            // Refetching on every window focus is noise, not freshness.
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>{children}</NuqsAdapter>
    </QueryClientProvider>
  );
}
