"use client";

import { useMemo } from "react";
import { parseAsArrayOf, parseAsString, throttle, useQueryState } from "nuqs";

import { toggleValue } from "../ui/controls";

/**
 * Filter state, in the query string.
 *
 * The shell already puts its own state there — which view is open, which panel is
 * wide, whether it is dark — so this is the same mechanism applied to the state
 * that had been left out of it. Which groups a view filters on belongs to that
 * view's own module.
 */

/** The groups a view has in force, and the two things you can do to them. */
export interface FilterParam {
  /** Empty means every group, which is the default and clears the URL key. */
  readonly selected: readonly string[];
  /** Adds the group if it is not in force, takes it off if it is. */
  readonly toggle: (key: string) => void;
  readonly clear: () => void;
}

/** `?alerts=high,critical` — a comma-separated list of the keys in force. */
const groups = parseAsArrayOf(parseAsString).withDefault([]);

/**
 * One group of toggles, mirrored into one query key.
 *
 * The key is named after the view that owns it — `?alerts=high,critical` — and
 * not after the property being filtered, because two of these views group their
 * rows by "kind". A shared `?kind=` would carry the satellite view's `weather`
 * into the conflicts view, match no incident, and show an empty list with no
 * chip pressed: a filter the operator did not set and cannot see to clear.
 *
 * Empty clears the key rather than writing `?alerts=`. History stays at nuqs'
 * default of `replace`: a chip press is not somewhere to navigate back to.
 */
export function useFilterParam(name: string): FilterParam {
  const [selected, setSelected] = useQueryState(name, groups);

  return {
    selected: selected ?? [],
    toggle: (key) => {
      void setSelected((was) => toggleValue(was, key));
    },
    clear: () => {
      void setSelected([]);
    },
  };
}

/** The text in a search field, mirrored into one query key. */
export interface SearchParam {
  readonly query: string;
  readonly set: (next: string) => void;
  readonly clear: () => void;
}

/**
 * The text in a search field, mirrored into one query key.
 *
 * This one behaves differently from {@link useFilterParam}, and the difference is
 * the input device. A chip is one press; a search box is a burst of keystrokes,
 * and each one reaching the browser's history API is a rate-limited write that
 * the browser may drop. So the URL update is throttled on the way out: the
 * keystrokes land in the field immediately and the list narrows as you type, and
 * the URL catches up once the burst pauses.
 *
 * Throttled rather than debounced, and the parser is built inside a `useMemo`
 * rather than inline in the hook body. A throttler keeps its own timer, so a
 * fresh one on every render has never had a call to time from and its trailing
 * edge never fires — the URL would then be written once and never again, which
 * is the same bug as not writing it at all.
 */
export function useSearchParam(name: string, waitMs = 400): SearchParam {
  const parser = useMemo(
    () => parseAsString.withDefault("").withOptions({ limitUrlUpdates: throttle(waitMs) }),
    [waitMs],
  );
  const [query, setQuery] = useQueryState(name, parser);

  return {
    query: query ?? "",
    set: (next) => {
      void setQuery(next);
    },
    clear: () => {
      void setQuery("");
    },
  };
}
