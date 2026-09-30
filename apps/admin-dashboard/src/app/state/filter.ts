"use client";

import { parseAsArrayOf, parseAsString, useQueryState } from "nuqs";

import { toggleValue } from "../ui/controls";

/**
 * Filter state, in the query string.
 *
 * The shell already puts its own state there — which view is open, which panel is
 * wide, whether it is dark — so this is the same mechanism applied to the state
 * that had been left out of it. Which groups a view filters on belongs to that
 * view's own module.
 *
 * There is one hook, and it is the filter. There was also a text search mirrored
 * the same way, for the one view that had a search box; that view counts and
 * filters on a carrier like every other one, and the field would have been a
 * second way to narrow a list of under a hundred rows.
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
