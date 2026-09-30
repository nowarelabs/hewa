import type { ReactElement } from "react";

import { useShellState } from "./state";
import type { RailItem } from "./types";

/**
 * The vertical icon rail beside the left panel.
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
  /** The item the left panel is drawing, which is the resolved one and not `item`. */
  activeId: string | null;
}): ReactElement | null {
  const { selectItem } = useShellState();

  if (items.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Sections"
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
            aria-pressed={isActive}
            onClick={() => selectItem(entry.id)}
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
