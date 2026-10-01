import type { ReactElement } from "react";

import { useShellState } from "./state";
import type { RailItem } from "./types";

/**
 * The vertical icon rail: the view's destinations.
 *
 * These are buttons that navigate, and they are marked as such. `aria-current`
 * rather than `aria-pressed` is the difference between a tab and a toggle: a
 * toggle says "I am on", a destination says "you are here", and the second is
 * what a reader of this column is being told. A rail built out of the view's
 * group vocabulary was a set of toggles wearing a rail's clothes.
 *
 * A single flat list per view, which is what it has always been at heart: the
 * shell used to keep one rail per view mode in a record keyed by a union of
 * literal strings, and the narrow-viewport menu kept a second, hand-written
 * copy of the same seven modes.
 */
export function IconRail({
  items,
  activeId,
}: {
  items: RailItem[];
  /** The selected destination, which is the resolved one and not the raw id. */
  activeId: string | null;
}): ReactElement | null {
  const { selectSection } = useShellState();

  if (items.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Sections in this view"
      className="flex w-12 shrink-0 flex-col items-center gap-1 border-e border-line bg-surface p-2"
    >
      {items.map((entry) => {
        const Icon = entry.icon;
        const isActive = entry.id === activeId;
        return (
          <button
            key={entry.id}
            type="button"
            title={entry.label}
            aria-label={entry.label}
            aria-current={isActive ? "page" : undefined}
            onClick={() => selectSection(entry.id)}
            className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
              isActive
                ? "bg-accent text-accent-ink hover:bg-accent-hover"
                : "bg-surface-raised text-ink-muted hover:bg-surface-sunken hover:text-ink"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </nav>
  );
}
