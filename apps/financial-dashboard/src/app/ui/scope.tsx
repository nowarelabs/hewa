import type { ReactElement } from "react";

import type { SectionStatus } from "../state/query";
import { FilterBar, FilterToggle } from "./controls";
import { Empty, emptyMessage, type SummaryItem } from "./primitives";

/**
 * The column beside the rail: what a section's rows are narrowed by.
 *
 * Twelve sections have a vocabulary the service publishes and four do not, so
 * this is a panel rather than part of the shell — and every section has *a* column
 * beside the rail, because `RailItem.left` is required. The four that publish no
 * vocabulary draw `SearchPanel` instead, which is the other half of the same slot
 * and is not a second way to narrow anything: a section with no group vocabulary
 * has no group for a group toggle to be a duplicate of.
 *
 * ## Why the narrowing is not in the main panel
 *
 * It was a bar under the heading, twelve times, and the bar was also the thing
 * that said how many rows there were. Those are two claims: *what am I looking
 * at* and *narrowed by what*. Putting both in one strip means the count under the
 * heading is a count of the unfiltered list while the table below it is filtered,
 * so the two disagree on purpose and the reader is left to work out which one the
 * table is honouring.
 *
 * So the strip under the heading states figures and this column answers the other
 * question. One control per filter, drawn once, and the number to check the table
 * against — `3 of 12 alerts` — is the one that moves when the table does.
 */
export interface ScopePanelProps {
  /**
   * Names the group of toggles, and is the only place the axis is named: "Filter
   * by severity". The column's visible heading is its panel title in the shell
   * config, where every other column's heading lives.
   */
  label: string;
  /** What the section's rows are called, plural: "alerts", "nodes". */
  noun: string;
  /**
   * The section's state, because a narrowing that has not arrived is not the same
   * as one that has nothing in it — and neither is the same as a service that did
   * not answer.
   */
  status: SectionStatus;
  /** The vocabulary, counts included. Empty while pending, which is why it is not asked for. */
  items: SummaryItem[];
  /** The groups in force. Empty means every group. */
  selected: readonly string[];
  onToggle: (key: string) => void;
  onClear: () => void;
}

export function ScopePanel({
  label,
  noun,
  status,
  items,
  selected,
  onToggle,
  onClear,
}: ScopePanelProps): ReactElement {
  if (status === "pending" || status === "failed") {
    // Not `filtered`: no group can be in force over rows that have not arrived,
    // and an empty column here says so rather than blaming a filter nobody set.
    return <Empty>{emptyMessage({ status, filtered: false, noun })}</Empty>;
  }

  if (items.length === 0) {
    // Only a section with no published vocabulary *and* no rows to work one out of
    // reaches this, because `summaryCounts` derives the groups from the rows when
    // the service sends none — which is what `settlement/runs` relies on. So this is
    // not a filter with nothing in force; there is no filter to be in force.
    //
    // Not "nothing matches", which is the same words about a different state and is
    // what the main column says when a reader has pressed something: a reader who
    // pressed nothing and is told nothing matches goes looking for the press they
    // cannot remember.
    return <Empty>This section has nothing to narrow by.</Empty>;
  }

  const rows = (inForce: readonly string[]): number =>
    items
      .filter((item) => inForce.length === 0 || inForce.includes(item.key ?? item.label))
      .reduce((sum, item) => sum + (countOf(item) ?? 0), 0);

  return (
    <div className="space-y-3" data-scope-panel="">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs text-ink-faint" data-scope-count>
          {rows(selected)} of {rows([])} {noun}
        </p>
        {selected.length === 0 ? null : (
          <button
            type="button"
            onClick={onClear}
            data-scope-clear=""
            className="text-xs text-accent hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      <FilterBar label={label} stacked>
        {items.map((item) => {
          const key = item.key ?? item.label;
          return (
            <FilterToggle
              key={key}
              group={key}
              label={item.label}
              count={countOf(item)}
              tint={item.tint}
              pressed={selected.includes(key)}
              onToggle={() => onToggle(key)}
              className="w-full justify-between"
            />
          );
        })}
      </FilterBar>
    </div>
  );
}

/**
 * Only a count belongs on a toggle. A vocabulary is groups, so a figure that
 * found its way in from a summary bar is shown without one rather than as zero,
 * which would be a claim about a group it knows nothing about.
 */
function countOf(item: SummaryItem): number | undefined {
  return typeof item.value === "number" ? item.value : undefined;
}
