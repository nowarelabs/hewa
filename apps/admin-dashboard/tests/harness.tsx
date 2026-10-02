import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing";
import { act, createElement, type ReactElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

import { consoleFixtures } from "./fixtures";

/**
 * Mounting a panel now means giving it a service to talk to.
 *
 * Every panel reads its rows through `useConsoleSection`, which is a React Query
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

/** A client with every section's rows already in it, and nothing left to fetch. */
export function seededQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY, retry: false } },
  });

  for (const [section, payload] of Object.entries(consoleFixtures)) {
    client.setQueryData(["console", section], payload);
  }

  return client;
}

/**
 * A client that has answered nothing, for the tests about not having answered.
 *
 * `retry: false` and not merely an empty cache: a panel mounted under this
 * mounts a query, and a query with nothing in the cache fetches — so the first
 * render is the pending one these tests want, and there is a request behind it.
 * `tests/query.test.ts` drives that request, and the connection error it prints
 * when no service is listening is the state it is describing.
 */
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

/* ------------------------------------------------------------------ mounts */

/**
 * Mounting something a test can press, type into, and read a query string from.
 *
 * `renderToStaticMarkup` is no use for that: it produces a string, so a press on it
 * does nothing and the URL cannot be read at all. So the two kinds of test get two
 * kinds of mount, and the second one lives here rather than in each file that needs
 * it — three copies of a `WeakMap`, a 600ms sleep and an `afterEach` is three
 * chances to disagree about when a URL write has landed.
 *
 * `hasMemory` is the part that makes the URL assertions mean anything: without it
 * the adapter freezes its initial params and every press would be asserted against
 * a URL that never moved, which is how a test for a filter that filters but never
 * writes passes.
 */

declare global {
  // `var` is the only thing a `declare global` can hold, and this is React's own
  // flag: it is what tells `act` it is running in a test rather than in a page.
  // Set at module load rather than in each file, because a mount without it warns
  // and a test suite that prints warnings trains people to ignore them.
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mounted: Root[] = [];

/**
 * The query string each mount's adapter last wrote, keyed by its container.
 *
 * Per mount, and not one shared slot: nuqs keeps its URL update queue in a
 * module-level global, so a throttled write from one test can land after the next
 * has mounted, and with a single shared slot that late write overwrites the current
 * test's value — the failure lands on a test that did nothing wrong.
 */
const written = new WeakMap<HTMLElement, string>();

export interface Mounted {
  container: HTMLElement;
  /** The query string the adapter has last written, after its writes have landed. */
  url: () => Promise<string>;
}

export function mountInteractive(
  element: ReactElement,
  searchParams = "",
  client: QueryClient = seededQueryClient(),
): Mounted {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  written.set(container, "");
  act(() =>
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(NuqsTestingAdapter, {
          hasMemory: true,
          searchParams,
          onUrlUpdate: onUrlUpdateFor(container),
          // In the props object rather than as a third argument to
          // `createElement`: the adapter declares `children` as a required prop
          // rather than the optional `PropsWithChildren` shape, and a required
          // `children` is not satisfied by the variadic overload. Nothing asserts
          // the shape of this literal — a `satisfies` naming only the two props we
          // read turns the rest into excess properties, which is how `hasMemory`
          // comes to be a type error in an adapter that declares it.
          children: element,
        }),
      ),
    ),
  );
  mounted.push(root);

  return { container, url: () => urlOf(container) };
}

function onUrlUpdateFor(container: HTMLElement): OnUrlUpdateFunction {
  return (event) => {
    written.set(container, event.queryString);
  };
}

/**
 * Let the query string catch up with the tree.
 *
 * nuqs rate-limits its URL writes — 50ms by default, and the search box asks for
 * 400ms — and coalesces everything inside that window into one write. The tree
 * updates on the press and the URL follows a moment later, so a test that reads the
 * URL the instant after a press is reading a race, and whether the leading or the
 * trailing edge of the window wins depends on the machine.
 *
 * Every reader here awaits it, so an assertion about the URL cannot forget to.
 */
export async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 600));
  });
}

export async function urlOf(container: HTMLElement): Promise<string> {
  await settle();
  return written.get(container) ?? "";
}

/**
 * Unmount everything mounted by {@link mountInteractive} and empty the document.
 *
 * Not exported as an `afterEach` from here: registering it in this module would run
 * it for the server-render tests too, which never mount anything.
 */
export function unmountAll(): void {
  for (const root of mounted.splice(0)) {
    act(() => root.unmount());
  }
  document.body.replaceChildren();
}

/**
 * Press a control, and return once the tree has caught up.
 *
 * Wrapped in `act` so React flushes the render before the assertion runs. It does
 * not wait for the URL: a press updates the value nuqs holds immediately and writes
 * the address bar a moment later, so a test about the tree should not pay for the
 * write, and a test about the write asks for it with `urlOf` or `settle`.
 */
export async function press(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click();
  });
}

/**
 * Submit a form, the way pressing its save button would.
 *
 * Dispatching the event rather than clicking the button, because happy-dom's
 * implicit submission is not dependable: the same order form, with the same markup,
 * submitted from a press in "new" mode and did not in "edit" mode, and no
 * assertion could tell the two apart. `Event("submit")` on the form is what React's
 * delegated `onSubmit` listens for, so this reaches the same handler a reader's
 * press does — and a suite that could not submit a form could not have caught a form
 * that sends the wrong body.
 */
export async function submit(form: HTMLFormElement): Promise<void> {
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    // Long enough for the write to leave. The handler starts the request and returns
    // without awaiting it, so a reader of the request that returns in the same tick
    // as the dispatch reads an array the write has not been pushed to yet.
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

/**
 * Type into a controlled input, the way a reader would.
 *
 * Through the prototype's own `value` setter rather than by assignment: React
 * installs a value tracker on the node, so `input.value = x` updates the tracker
 * too and the `input` event that follows reads as "nothing changed", and the
 * component never re-renders.
 *
 * `Reflect.set` with an explicit receiver, rather than reading the descriptor's
 * `set` and calling it: the receiver is what makes it a native setter at all, and
 * naming that `set` on its own is the shape of code that loses it. The lookup
 * starts at the prototype, so React's own descriptor on the node is skipped —
 * which is the whole point of the exercise.
 */
export async function type(input: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    Reflect.set(HTMLInputElement.prototype, "value", value, input);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
}
