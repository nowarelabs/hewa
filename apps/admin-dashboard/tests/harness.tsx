import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { consoleFixtures } from "./fixtures";

/**
 * Mounting a panel now means giving it a service to talk to.
 *
 * Every panel reads its rows through `useConsoleView`, which is a React Query
 * hook, so a panel rendered without a `QueryClientProvider` throws — and a panel
 * rendered under one with nothing in the cache renders "Loading alerts…" instead
 * of a table. Both would have made this suite fail for the wrong reason, so the
 * payloads are seeded into a fresh client before the tree is built.
 *
 * Seeded rather than fetched, because `renderToStaticMarkup` has no effects: a
 * query that resolves in an effect resolves after the string has already been
 * produced, and every assertion about it would see the pending state. A panel
 * that renders from cache is exactly what SSR does, so this is not a shortcut —
 * it is the first render, which is the one worth asserting on.
 */

/** A client with every view's rows already in it, and nothing left to fetch. */
export function seededQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY, retry: false } },
  });

  for (const [view, payload] of Object.entries(consoleFixtures)) {
    client.setQueryData(["console", view], payload);
  }

  return client;
}

/** A client that has answered nothing, for the tests about not having answered. */
export function emptyQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY, retry: false } },
  });
}

/**
 * The providers a panel runs under in the app, with a seeded cache.
 *
 * nuqs is here because half the panels read their filter state out of the query
 * string, and it throws NUQS-404 rather than quietly falling back when it cannot
 * find an adapter — which is the failure you want, and not the one to get here.
 */
export function withConsole(element: ReactElement, client = seededQueryClient()): ReactNode {
  return createElement(
    QueryClientProvider,
    { client },
    createElement(NuqsTestingAdapter, null, element),
  );
}

/** `withConsole`, for a string. */
export function renderConsole(element: ReactElement, client?: QueryClient): string {
  return renderToStaticMarkup(withConsole(element, client) as ReactElement);
}
