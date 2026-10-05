"use client";

import { parseAsArrayOf, parseAsString, useQueryState } from "nuqs";

import { toggleValue } from "../ui/controls";

/**
 * Filter state, in the query string.
 *
 * The shell already puts its own state there — which view is open, which section
 * is selected, which panel is wide, whether it is dark — so this is the same
 * mechanism applied to the state that had been left out of it. Which groups a
 * section filters on belongs to that section's own panel.
 *
 * There are two hooks here and both are narrowing: the groups a section filters
 * on, and a search over the rows it lists.
 *
 * The search came back because four sections publish no vocabulary at all — the
 * three market documents and the provider rollup — and they were left with a
 * column that could only be empty. They are not narrowed twice by it: a section
 * with no group vocabulary has nothing for a group toggle to be a second copy of.
 * A section that *has* a vocabulary does not also get a search box, for the same
 * reason it does not get a second strip of chips under its heading: one control
 * per question.
 */

/** The groups a view has in force, and the two things you can do to them. */
export interface FilterParam {
  /** Empty means every group, which is the default and clears the URL key. */
  readonly selected: readonly string[];
  /** Adds the group if it is not in force, takes it off if it is. */
  readonly toggle: (key: string) => void;
  readonly clear: () => void;
}

/** `?alerts-feed=high,critical` — a comma-separated list of the keys in force. */
const groups = parseAsArrayOf(parseAsString).withDefault([]);

/**
 * A term, with the default being the empty one so clearing removes the key.
 *
 * No `throttleMs`, which is the more surprising setting here. nuqs' rate limit
 * applies to the hook's value as well as to the URL, and this value is what the
 * table filters on: a 400ms window puts four hundred milliseconds between the
 * keypress and the rows, on every keystroke. The default 50ms coalesces a burst of
 * typing into a write or two and leaves the rows where the reader's eyes are.
 */
const text = parseAsString.withDefault("");

/**
 * One group of toggles, mirrored into one query key.
 *
 * The key is named after the **section** that owns it —
 * `?alerts-feed=high,critical`, `?infrastructure-nodes=ixp` — and not after the
 * property being filtered, because two sections group their rows by "kind" and
 * four group theirs by "severity". A shared `?kind=` would carry one section's
 * `payout` into another's, match no row, and show an empty list with no chip
 * pressed: a filter the operator did not set and cannot see to clear.
 *
 * Section rather than view, because a section is the destination now and two
 * sections of one view are as entitled to their own filter as two views are.
 * `infrastructure/nodes` and `infrastructure/headroom` both filter by kind, and
 * they answer different questions about the same rows — pressing `ixp` on one
 * and arriving at the other is a fresh look, not a filter that followed them.
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

/** What a section's search is in force, and the two things you can do to it. */
export interface SearchParam {
  /** The term as typed, which is not the term as matched — that is trimmed. */
  readonly query: string;
  readonly set: (value: string) => void;
  readonly clear: () => void;
}

/**
 * The query key a section's search is mirrored into.
 *
 * `q-` first, then the section with its separator flattened: `q-market-book`. The
 * prefix is what keeps a search from colliding with a group vocabulary — a group
 * key is a group's own value (`ixp`, `critical`), so without it a section whose
 * rows hold a key called `q-market-book` would filter on it and read the search
 * as one of its groups.
 *
 * Section, like the group keys, because a section is the destination: `?q-market-book`
 * and `?q-infrastructure-nodes` are two searches of two screens, and carrying one
 * to the other would narrow a list by a term that means nothing there.
 */
export function searchKey(section: string): string {
  return `q-${section.replaceAll("/", "-")}`;
}

/** One search, mirrored into one query key. */
export function useSearchParam(section: string): SearchParam {
  const [query, setQuery] = useQueryState(searchKey(section), text);

  return {
    query: query ?? "",
    set: (value) => {
      void setQuery(value);
    },
    clear: () => {
      void setQuery("");
    },
  };
}
