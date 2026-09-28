"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * The shared React Query client.
 *
 * Built in `useState` rather than at module scope on purpose: a module-scope
 * client is created once per server process and then shared by every request
 * that renders on it, so one user's cached data can be served to another. One
 * client per browser session is the correct lifetime.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Telemetry, usage, and payout data all move on their own schedule.
            // Refetching on every window focus is noise, not freshness.
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
