import type { ReactElement } from "react";
import { Search } from "lucide-react";

import type { SectionStatus } from "../state/query";
import { Empty, emptyMessage } from "./primitives";

/**
 * The column beside the rail, when a section's rows are found by name.
 *
 * `ScopePanel` is the other half of the same slot: four of the sixteen sections
 * publish no vocabulary, and they were left with a column that could only be
 * empty — which reads as a column that failed to load, and which took the rail
 * from reading as navigation to reading as a set of similar screens that vary in
 * width. So those four answer with a search over the rows they list.
 *
 * ## A search is not a second filter
 *
 * A section that narrows by group does not also get a search box. Two controls
 * for one question is the same defect as two strips of chips for one filter: the
 * reader presses one, watches the list change, and cannot say which of them the
 * other is for. Every section here has exactly one narrowing control, and for
 * twelve of them it is the vocabulary they publish.
 *
 * The count is the reason this panel exists in the shape it does. `2 of 14 orders`
 * moves when the table moves, which is the number to check the table against; the
 * main column's heading says how many there are in all, which is a different
 * claim and is not narrowed to agree with the first.
 */
export interface SearchPanelProps {
  /** What the section's rows are called, plural: "orders", "pools". */
  noun: string;
  /**
   * The section's state, because a search over rows that have not arrived is not a
   * search with nothing in it — and neither is a service that did not answer.
   */
  status: SectionStatus;
  /** The term as typed. */
  query: string;
  onChange: (value: string) => void;
  onClear: () => void;
  /** Rows the term leaves. */
  matched: number;
  /** Rows there are before the term. */
  total: number;
}

export function SearchPanel({
  noun,
  status,
  query,
  onChange,
  onClear,
  matched,
  total,
}: SearchPanelProps): ReactElement {
  if (status === "pending" || status === "failed") {
    // Not "0 of 0", and not the input: a field over a service that has not
    // answered is a field that accepts a term and then matches nothing, which is
    // indistinguishable from a wrong term.
    return <Empty>{emptyMessage({ status, filtered: false, noun })}</Empty>;
  }

  return (
    <div className="space-y-3" data-search-panel="">
      <label className="block">
        <span className="sr-only">{`Find ${noun}`}</span>
        <span className="relative block">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => onChange(event.target.value)}
            placeholder={`Find ${noun}`}
            data-search-input=""
            className="w-full rounded border border-line bg-surface-raised py-1.5 pl-8 pr-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
        </span>
      </label>

      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs text-ink-faint" data-search-count>
          {matched} of {total} {noun}
        </p>
        {query === "" ? null : (
          <button
            type="button"
            onClick={onClear}
            data-search-clear=""
            className="text-xs text-accent hover:underline"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The rows a term leaves, for a main panel and the search column beside it.
 *
 * Every whitespace-separated word has to match, case-insensitively, somewhere in
 * the row's searchable fields. And-ed rather than or-ed because "subsea cable"
 * should find the subsea cable rows and "subsea jamaica" should find neither, and
 * an or would return the union of both — a search that widens as it is made more
 * specific.
 *
 * The fields are passed in rather than the whole row: a row's id is not something
 * a reader types, and matching it would let `?q=al-9` find an alert by its
 * internal key, which is a different question from the one on screen.
 *
 * A blank term leaves every row, and it is written the way it is for the same
 * reason `visibleBy` is: an empty selection means everything, and the version of
 * this that filters on `""` returns nothing at all.
 */
export function searchRows<T>(
  rows: readonly T[],
  term: string,
  fields: (row: T) => readonly string[],
): T[] {
  const words = term
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== "");
  if (words.length === 0) {
    return [...rows];
  }
  return rows.filter((row) => {
    const haystack = fields(row).join(" ").toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}
