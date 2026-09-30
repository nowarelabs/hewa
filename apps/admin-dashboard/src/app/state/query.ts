"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  consolePath,
  type ConsoleData,
  type ConsoleGroups,
  type ConsolePayload,
  type ConsoleViewKey,
} from "@hewa/console-types";
import { ResponseCode } from "@hewa/response-codes";

/**
 * The console's one call out of the browser.
 *
 * This is the boundary. Everything above it — the seven `data/` modules, the
 * panels, the summary bars — works in terms of {@link ConsolePayload} and never
 * sees a URL, a `fetch`, or a response code. Everything below it lives behind a
 * route handler in this same app.
 *
 * It is here and not in each of the seven modules because the fetch is the same
 * fetch. Seven modules each opening their own connection to the same service to
 * read a different path is seven places to put a base URL, seven places to fix
 * when it moves, and seven chances to answer an error differently.
 */

/**
 * The app's own origin, so there is no base URL to configure.
 *
 * A relative path, and this is the only reason the app is not `NEXT_PUBLIC_CENTRAL_API_URL`.
 * That variable had to be inlined into the client bundle at build time, which put
 * central-api's address — and, on a deploy where the token had been shipped the
 * same way, central-api's secret — into every visitor's devtools. Asking the
 * browser for `/api/v1/alerts` instead means it asks the origin it was loaded
 * from, and the route handler under `app/api/v1` decides what that is worth: it
 * reads the address and the token from the server's own environment and attaches
 * the token on the way out. Nothing about central-api is in the bundle, so there
 * is nothing to leak and nothing to keep in step across two deploys.
 *
 * The consequence worth stating is that a CORS preflight can no longer happen
 * here at all, and central-api's own CORS policy is scoped away from `/api/v1`
 * for the same reason.
 */

/**
 * How long a view's rows may be served from cache before they are refetched.
 *
 * Long enough that moving between two panels does not refetch the one you came
 * from, and short enough that coming back to a panel is not a look at a snapshot
 * from an hour ago.
 */
export const STALE_TIME_MS = 30_000;

/**
 * What one view is in the middle of being.
 *
 * The distinction is the whole point of this hook. Before the rows were fetched,
 * a panel said "no alerts match these severities" over a service that had not
 * answered — three different situations rendering the same confident sentence,
 * and the operator sent looking for a filter that was not the problem.
 *
 * `data` is `undefined` until the service has actually answered, rather than an
 * empty list. An empty list is a claim about the world; there is no honest empty
 * value to offer for a view whose data is an object rather than a list, and the
 * one place that would have to invent one is the one place that must not.
 */
export type ViewStatus = "pending" | "failed" | "ready";

export interface ViewState<TView extends ConsoleViewKey> {
  /** `pending` before the first answer, `failed` when there was none. */
  readonly status: ViewStatus;
  /** The rows, or the figures. Present only when the service has answered. */
  readonly data: ConsoleData<TView> | undefined;
  /**
   * The view's group vocabulary, as the service names it.
   *
   * Empty before the first answer and empty for a view that has no groups, which
   * is a different thing that happens to look the same. The bar below a view with
   * no vocabulary passes no filter, so nothing is offered.
   */
  readonly groups: ConsoleGroups<TView>;
  readonly refetch: () => void;
}

async function fetchView<TView extends ConsoleViewKey>(
  view: TView,
): Promise<ConsolePayload[TView]> {
  const response = await fetch(consolePath(view), {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    // The status, not the body. A 500 carries its own diagnostics and may carry
    // customer data, and neither belongs in an error an operator reads in a
    // browser. The route handler has already made that call for anything that
    // came off the wire; this is about this app's own failures.
    throw new Error(`${consolePath(view)} answered ${response.status}`);
  }

  const payload = (await response.json()) as ConsolePayload[TView];

  if (payload.code !== ResponseCode.Ok) {
    throw new Error(`${consolePath(view)} refused the request with code ${payload.code}`);
  }

  return payload;
}

/**
 * One view's rows, live.
 *
 * Keyed by the view name, so React Query holds one entry per view and a panel
 * that unmounts and remounts — which is what collapsing one does — reads its rows
 * back from the cache instead of asking again.
 */
export function useConsoleView<TView extends ConsoleViewKey>(view: TView): ViewState<TView> {
  const query: UseQueryResult<ConsolePayload[TView]> = useQuery({
    queryKey: ["console", view],
    queryFn: () => fetchView(view),
    staleTime: STALE_TIME_MS,
  });

  const payload = query.data;

  return {
    status: query.isError ? "failed" : payload === undefined ? "pending" : "ready",
    data: payload?.data,
    groups: (payload?.meta.groups ?? []) as ConsoleGroups<TView>,
    refetch: () => {
      void query.refetch();
    },
  };
}
