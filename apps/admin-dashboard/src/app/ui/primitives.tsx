import type { ReactElement, ReactNode } from "react";
import { FilterBar, FilterToggle, SearchField } from "./controls";
import type { SearchFieldProps } from "./controls";

/**
 * The two shapes most of this console's panels take.
 *
 * The first version of this app had a file per panel: thirty-nine of them were
 * the same seven lines with a different noun in them, and four more declared
 * their own copy of the `FlightData` interface. The data is still per view and
 * still lives in a file, but a panel that is only a heading and a line of
 * placeholder text is now two calls in the shell config rather than a module.
 *
 * These are the parts every view shares, so they are not a view. A file in
 * `panels/` is one view and is named after its key in `shell.config.tsx`; this
 * one is a view's vocabulary and is named for that.
 */

/** A panel heading, optionally with a supporting line under it. */
export function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: ReactNode;
  children?: ReactNode;
}): ReactElement {
  return (
    <section className="p-4">
      <h3 className="mb-3 text-sm font-medium text-ink">{title}</h3>
      {note !== undefined ? <p className="text-sm text-ink-muted">{note}</p> : null}
      {children}
    </section>
  );
}

/**
 * A list of label and value rows, the shape the economy and satellite panels
 * use. `rows` is data rather than JSX so a view can declare it inline.
 */
export function KeyValues({ rows }: { rows: { label: string; value: ReactNode }[] }): ReactElement {
  return (
    <dl className="space-y-2">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between gap-2">
          <dt className="text-sm text-ink-muted">{row.label}</dt>
          <dd className="text-sm font-medium text-ink tabular-nums">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A bordered stack of titled cards, the shape the list panels use. */
export function CardList({
  items,
}: {
  items: { id: string; title: string; detail?: ReactNode }[];
}): ReactElement {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <article key={item.id} className="rounded border border-line bg-surface-raised p-2">
          <h4 className="text-sm font-medium text-ink">{item.title}</h4>
          {item.detail !== undefined ? (
            <p className="mt-0.5 text-xs text-ink-muted">{item.detail}</p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

/** The empty case every list panel needs, so none of them forgets it. */
export function Empty({ children }: { children: ReactNode }): ReactElement {
  return <p className="text-xs text-ink-faint">{children}</p>;
}

/**
 * One chip in a {@link SummaryBar}.
 *
 * `key` is the value a filter toggles on, which is not always the label: the
 * osint view upper-cases its categories, and a filter that toggled on "CIA"
 * would be toggling on a string the caller has to keep in step with the display
 * by hand. `label` is only a fallback, for the views that pass items inline.
 */
export interface SummaryItem {
  label: string;
  value: ReactNode;
  /** Replaces the neutral chip colour, usually with the view's own tint. */
  tint?: string;
  /** The group's own value, as the data spells it. */
  key?: string;
}

/**
 * The rows a filter leaves, for a bar that is a breakdown of them.
 *
 * Shared because the one rule worth getting right here is that no selection
 * means everything. Written five times, one of them is `[selected].length > 0
 * && selected.includes(...)` and that view filters to an empty list the moment
 * its last chip is turned off, with no error and no empty state to explain it.
 */
export function visibleBy<T, K extends string>(
  items: readonly T[],
  of: (item: T) => K,
  selected: readonly K[],
): T[] {
  if (selected.length === 0) {
    return [...items];
  }
  return items.filter((item) => selected.includes(of(item)));
}

/**
 * What a summary bar filters on, when it filters.
 *
 * A list of keys rather than a list of booleans, because "which groups are in
 * force" is the question and an array of booleans indexed by category is a
 * second, parallel way of asking it. Empty means everything, which is why
 * turning the last filter off is the same as never having turned one on.
 */
export interface SummaryFilter {
  /** Names the group of toggles: "Filter by severity". */
  label: string;
  selected: readonly string[];
  onToggle: (key: string) => void;
}

export interface SummaryBarProps {
  items: SummaryItem[];
  /**
   * Given, each chip becomes a toggle and the strip becomes a filter bar.
   *
   * This is the morph. The bar already says "there are three high alerts", and
   * the only reason to read that sentence is to go and look at the three high
   * alerts, so the number that answers the question is made into the control that
   * asks it. A view whose bar is a breakdown of the rows beneath it should pass
   * this; a view whose bar is not one should not, and there is no way to
   * discover that by reading the component — it is per view and the choice is
   * recorded in each view's module.
   */
  filter?: SummaryFilter;
  /**
   * A search field in the same strip, for a list that is keyed by text.
   *
   * Not a substitute for `filter`: a search finds one of eight hundred rows and
   * a filter says how many of everything there are. The one view that has both
   * is flights, which is a live feed looked up by callsign.
   */
  search?: SearchFieldProps;
}

/**
 * The strip between a main panel's title and its contents.
 *
 * The alerts view grew one of these by hand — four severity counts in a `<div>`
 * written inline — and the other six mains had nothing, so a view either had a
 * summary or had no way to say what it was showing before you scrolled. This is
 * that strip, and the counts are the view's own: a breakdown of the rows below
 * it, grouped the way its rail groups them. The economy view has no rows to
 * count, so it puts its headline figures in the same place — and passes no
 * `filter`, because a figure is not a group and a filter that hides nothing is a
 * control that lies.
 */
export function SummaryBar({ items, filter, search }: SummaryBarProps): ReactElement | null {
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      data-summary-bar=""
      data-filterable={filter === undefined ? undefined : ""}
      className="flex flex-wrap items-center gap-2 border-b border-line p-3"
    >
      {search === undefined ? null : (
        <div className="min-w-40 flex-1">
          <SearchField {...search} />
        </div>
      )}

      {filter === undefined ? (
        items.map((item) => (
          <span
            key={item.label}
            data-summary-item={item.key}
            className={`rounded border px-2 py-1 text-xs ${
              item.tint ?? "border-line bg-surface-raised text-ink-muted"
            }`}
          >
            {item.label}: {item.value}
          </span>
        ))
      ) : (
        <FilterBar label={filter.label} className="flex-1">
          {items.map((item) => {
            const key = item.key ?? item.label;
            return (
              <FilterToggle
                key={key}
                group={key}
                label={item.label}
                // Only a count belongs on a toggle. A bar that mixes figures in
                // with counts is a bar that has nothing to filter on, and
                // `Number("NBO")` is a number with no rows behind it.
                count={typeof item.value === "number" ? item.value : undefined}
                tint={item.tint}
                pressed={filter.selected.includes(key)}
                onToggle={() => filter.onToggle(key)}
              />
            );
          })}
        </FilterBar>
      )}
    </div>
  );
}

/**
 * Counts a list by one of its fields, for a {@link SummaryBar}.
 *
 * Every list view wants the same strip: how many of each kind. The counts come
 * from the rows rather than from a table of names, so a category someone adds
 * to the data without adding to the rail is still counted — a hand-written list
 * of categories is how a bar ends up quietly disagreeing with the list below
 * it.
 *
 * `keys` is the other half of that. Pass a view's known categories and they are
 * shown even at zero, which is what stops a bar losing chips while the flights
 * worker is still loading, and what the alerts severities do. Anything found in
 * the data is added to them, never dropped, so `keys` cannot hide a category.
 */
export function summaryCounts<T, K extends string>(
  items: readonly T[],
  of: (item: T) => K,
  options: {
    keys?: readonly K[];
    label?: (key: K) => string;
    tint?: (key: K) => string | undefined;
  } = {},
): SummaryItem[] {
  const found = items.map(of);
  const keys = options.keys === undefined ? found : [...new Set([...options.keys, ...found])];
  return [...new Set(keys)].map((key) => ({
    key,
    label: options.label?.(key) ?? key.charAt(0).toUpperCase() + key.slice(1),
    value: found.filter((value) => value === key).length,
    tint: options.tint?.(key),
  }));
}

/**
 * The seven side panels that are waiting on a selection.
 *
 * Every one of these panels used to be its own file whose entire body was a
 * heading and the words "Select a flight to view details". The heading is the
 * panel's `title` now, so the file went away and this took its place.
 */
export function SelectPrompt({ what }: { what: string }): ReactElement {
  return <Empty>{`Select ${what} to view details`}</Empty>;
}

/**
 * The assistant column, which is currently a promise rather than a feature.
 *
 * Seven files said "AI Assistant" and then one sentence about what it would do.
 * The sentence differs per view and the file did not, so the view declares the
 * sentence and this renders it.
 */
export function Assistant({ task }: { task: string }): ReactElement {
  return (
    <section className="p-4">
      <h3 className="mb-3 text-sm font-medium text-ink">AI assistant</h3>
      <p className="text-xs text-ink-faint">{task}</p>
    </section>
  );
}
