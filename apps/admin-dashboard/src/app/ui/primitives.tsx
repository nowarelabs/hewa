import type { ReactElement, ReactNode } from "react";

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
