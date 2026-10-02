import type { ReactElement, ReactNode } from "react";

/**
 * The shapes most of this console's panels take.
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
 * What an empty list is allowed to say, which depends on why it is empty.
 *
 * Every view's rows now arrive from a service, so "the list is empty" has three
 * causes and the panel can only tell them apart by asking: nothing has answered
 * yet, nothing answered, or the answer was empty. All three render nothing, and
 * the panel that cannot tell them apart says "No alerts match these severities"
 * over a service that is down — a confident, specific, wrong statement, and the
 * worst of the three because the operator goes looking for a filter that is not
 * the problem.
 *
 * So the question is asked once, here, and the answer is a string. A string is
 * also the part that is worth asserting in a test without rendering anything.
 */
export function emptyMessage(state: {
  /**
   * One value rather than two booleans.
   *
   * `pending` and `failed` are not independent — a request cannot be both — so
   * two booleans would admit a fourth state that exists in the type and nowhere
   * else, and the one place that decides what an empty list is saying would be
   * the one place that has to cope with it.
   */
  readonly status: "pending" | "failed" | "ready";
  /** A filter or a search is in force, so an empty answer is the filter's doing. */
  readonly filtered: boolean;
  /** The view's plural noun: "alerts". */
  readonly noun: string;
  /** Names the filter in force: "these severities". */
  readonly filter?: string;
}): string {
  if (state.status === "pending") {
    return `Loading ${state.noun}…`;
  }

  if (state.status === "failed") {
    return `Could not reach central-api for ${state.noun}`;
  }

  if (state.filtered) {
    return `No ${state.noun} match ${state.filter ?? "the filters"}`;
  }

  return `No ${state.noun} to show`;
}

/**
 * One group of a section's vocabulary: a label, how many rows are in it, and the
 * key a filter toggles on.
 *
 * `key` is the value a filter toggles on, which is not always the label: the
 * alerts severities are lowercase in the data and title-cased on screen, and a
 * filter that toggled on "Critical" would be toggling on a string the caller has
 * to keep in step with the display by hand. `label` is only a fallback, for the
 * figures a bar is given inline.
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
 * The rows a filter leaves, for a main panel and the scope column beside it.
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

export interface SummaryBarProps {
  items: SummaryItem[];
}

/**
 * The strip between a main panel's title and its contents.
 *
 * The alerts view grew one of these by hand — four severity counts in a `<div>`
 * written inline — and the other six mains had nothing, so a view either had a
 * summary or had no way to say what it was showing before you scrolled. This is
 * that strip, and the figures are the view's own.
 *
 * ## It states figures and does not filter
 *
 * It used to take a `filter`, and each chip that had a count behind it became a
 * toggle — the morph, on the argument that a count you want is a list you want.
 * Twelve sections did it that way, and the filter moved to the left column.
 *
 * A bar that filters and a bar that reports are two different claims, and a bar
 * that does both is whichever one the reader last touched: press `critical` in
 * the left column and the strip under the heading keeps saying how many critical
 * alerts there were, so the number the reader checks against the table is a
 * number the filter has already changed. Now the strip only answers "what am I
 * looking at", the scope column answers "narrowed by what", and a section has
 * one of each rather than two of the second.
 *
 * So a bar item is a figure or a count of something that is not a group. Pass a
 * key and it is ignored: the keys belong to `summaryCounts`, which feeds the
 * scope column.
 *
 * ## Not on a phone
 *
 * `group-data-[shell-layout=sheet]:hidden`, so the shell decides. Below the
 * breakpoint the bar is a row of a table that a reader cannot act on and cannot
 * scroll past without losing their place, and the counts it holds are the counts
 * the table already draws; the filter that *is* actionable is a sheet one press
 * away. What is left on a phone is the table.
 */
export function SummaryBar({ items }: SummaryBarProps): ReactElement | null {
  if (items.length === 0) {
    return null;
  }

  return (
    // Gone on a narrow screen: it is a row of the table given away, and the one
    // strip in a panel that cannot be acted on — it states figures and narrows
    // nothing, so a phone reader loses a row and keeps every control. The line is
    // the shell's own measurement, read through its `group`, because a second copy
    // of 768px in a panel is a third reading of a width two other things already
    // depend on.
    <div
      data-summary-bar=""
      className="group-data-[shell-layout=sheet]:hidden flex flex-wrap items-center gap-2 border-b border-line p-3"
    >
      {items.map((item) => (
        <span
          key={item.label}
          className={`rounded border px-2 py-1 text-xs ${
            item.tint ?? "border-line bg-surface-raised text-ink-muted"
          }`}
        >
          {item.label}: {item.value}
        </span>
      ))}
    </div>
  );
}

/**
 * Counts a list by one of its fields, for the scope column or a summary bar.
 *
 * Every list view wants the same breakdown: how many of each kind. The counts come
 * from the rows rather than from a table of names, so a category someone adds to
 * the data without adding to the rail is still counted — a hand-written list of
 * categories is how a bar ends up quietly disagreeing with the list below it.
 *
 * `keys` is the other half of that. Pass a section's known groups and they are
 * shown even at zero, which is what stops the column losing a toggle as the data
 * moves, and what the alerts severities do. Anything found in the data is added to
 * them, never dropped, so `keys` cannot hide a group.
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
 * One named analysis the assistant column can offer on a view.
 *
 * A widget is a **name and a sentence**, not a component and not a figure. The
 * first version of this column wanted a card per view and put the card in each
 * view's panel module, which meant the panel had to hold state the shell could
 * not see and the shell had no way to know the column was more than a heading.
 * Naming the analysis here keeps the column honest about what it is: it says
 * what it would work out, and it does not pretend to have worked it out.
 *
 * `id` is stable because it is what a test asserts on and what a future wiring
 * would key a result by; `name` is the heading, `summary` is the one sentence
 * that says what the answer would be worth.
 */
export interface AssistantWidget {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
}

/**
 * The assistant column: what this view would ask for, and nothing else.
 *
 * `widgets` is optional and is empty on the views with nothing to offer rather
 * than hidden. A column that appears and disappears with the tab strip is chrome
 * that moves, and the panel button would be answering to a layout that changes
 * under the operator.
 */
export function Assistant({
  task,
  widgets = [],
}: {
  /** What the column is for on this view. One sentence, in the app's voice. */
  task: string;
  widgets?: readonly AssistantWidget[];
}): ReactElement {
  return (
    <section className="p-4">
      <h3 className="mb-3 text-sm font-medium text-ink">AI assistant</h3>
      <p className="mb-4 text-xs text-ink-faint">{task}</p>
      {widgets.length === 0 ? null : (
        <ul className="space-y-2">
          {widgets.map((widget) => (
            <li
              key={widget.id}
              data-assistant-widget={widget.id}
              className="rounded border border-line bg-surface-raised p-3"
            >
              <h4 className="text-sm font-medium text-ink">{widget.name}</h4>
              <p className="mt-1 text-xs text-ink-faint">{widget.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
