import type { ReactElement } from "react";

import type { ViewSpec } from "./types";

/**
 * The view tabs, and the one piece of chrome that lives in two bars.
 *
 * This is the reader's answer to "where am I", and it is the only control that
 * moves between layouts. On a wide screen it sits in the title bar beside the app's
 * own actions; on a narrow one it sits in the status bar, under the thumb holding
 * the phone rather than at the top of a screen the reader has to reach up to. Every
 * other control stays where it was — a title bar that also moved its toggles and
 * its account corner would be a second responsive answer to one question, and the
 * second one would be the one nobody reviewed.
 *
 * It is a component rather than two implementations because a tab strip written
 * twice is a tab strip that has drifted: the second copy is missing the last view,
 * or is reading the active view from somewhere else, and the bar that nobody was
 * looking at is the one that is wrong. {@link ViewTabs} is the same element in
 * both bars, so a reader who learns it in one has learned it in the other.
 */
export function ViewTabs({
  entries,
  active,
  onSelect,
  fill = false,
}: {
  entries: [string, ViewSpec][];
  active: string;
  onSelect: (id: string) => void;
  /**
   * Divide the width of the bar, rather than sit at the left of it.
   *
   * For the status bar, which is nothing but this strip: tabs sized to their
   * labels would leave the rest of the row as dead space beside them, and a bottom
   * bar with dead space in it reads as a bar with something missing. Equal shares
   * make the whole row the control, and they cost nothing to use — every view is
   * under the reader's thumb either way.
   */
  fill?: boolean;
}): ReactElement {
  return (
    // Scrollable rather than clipped: the labels are hidden below `lg`, so the
    // strip fits an icon per view on a phone unless there are more views than a
    // phone has room for icons, and a tab you cannot reach is not a tab. Filling
    // needs neither: equal shares fit by construction.
    <div
      data-shell-view-tabs=""
      role="tablist"
      className={`flex min-w-0 items-center gap-1 ${fill ? "w-full" : "overflow-x-auto"}`}
    >
      {entries.map(([id, spec], index) => {
        const Icon = spec.icon;
        const isActive = id === active;
        const edge =
          index === 0 ? "rounded-l-md" : index === entries.length - 1 ? "rounded-r-md" : "";
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            title={spec.longLabel ?? spec.label}
            onClick={() => onSelect(id)}
            className={`inline-flex h-8 items-center justify-center gap-1 border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${fill ? "flex-1" : "shrink-0"} ${edge} ${
              index > 0 ? "-ml-px" : ""
            } ${
              isActive
                ? "border-accent bg-accent text-accent-ink hover:bg-accent-hover"
                : "border-line bg-surface-raised text-ink-muted hover:bg-surface-sunken hover:text-ink"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden lg:inline">{spec.label}</span>
          </button>
        );
      })}
    </div>
  );
}
