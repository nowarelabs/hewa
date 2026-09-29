import type { ReactElement } from "react";
import { Clock, Maximize2, ZoomIn, ZoomOut } from "lucide-react";

import { ActionGroup } from "./ActionGroup";
import type { StatusSpec } from "./types";

const PILL =
  "inline-flex h-7 items-center justify-center rounded border border-line bg-surface-raised px-2 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink disabled:pointer-events-none disabled:opacity-40";

const MUTED = "flex items-center gap-1 text-xs text-ink-faint";

/**
 * The bottom chrome: the current view's message and actions on the left, its
 * counters, and zoom and a save stamp on the right.
 *
 * Every cluster is optional and rendered only when the view declares it. The
 * previous version had an either/or between the action buttons and the counter
 * row, and because every view declared actions, the counter row was
 * unreachable and the zoom cluster defaulted to a dead `100%`.
 */
export function StatusBar({ spec }: { spec: StatusSpec }): ReactElement {
  const { message, actions = [], stats = [], zoom, savedAt } = spec;
  const hasLeft = message !== undefined || actions.length > 0 || stats.length > 0;
  const hasRight = zoom !== undefined || savedAt !== undefined;

  if (!hasLeft && !hasRight) {
    return <div aria-hidden="true" className="h-8 border-t border-line bg-canvas" />;
  }

  return (
    <footer className="border-t border-line bg-canvas">
      <div className="flex items-center justify-between gap-3 overflow-x-auto px-3 py-1.5">
        <div className="flex shrink-0 items-center gap-2">
          {message !== undefined ? <span className="text-xs text-ink-muted">{message}</span> : null}
          {message !== undefined && actions.length > 0 ? (
            <div aria-hidden="true" className="h-4 border-l border-line" />
          ) : null}
          <ActionGroup actions={actions} size="label" />
          {stats.map((stat) => (
            <span key={stat.id} className={MUTED}>
              {stat.value} {stat.label}
            </span>
          ))}
        </div>

        {hasRight ? (
          <div className="flex shrink-0 items-center gap-2">
            {zoom !== undefined ? (
              <div className="flex items-center gap-1 text-xs text-ink-faint">
                <button
                  type="button"
                  className={PILL}
                  onClick={zoom.onZoomOut}
                  disabled={zoom.onZoomOut === undefined}
                  title="Zoom out"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="h-3 w-3" />
                </button>
                <span className="w-12 text-center tabular-nums">{zoom.value}%</span>
                <button
                  type="button"
                  className={PILL}
                  onClick={zoom.onZoomIn}
                  disabled={zoom.onZoomIn === undefined}
                  title="Zoom in"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  className={PILL}
                  onClick={zoom.onFit}
                  disabled={zoom.onFit === undefined}
                  title="Fit to screen"
                  aria-label="Fit to screen"
                >
                  <Maximize2 className="h-3 w-3" />
                </button>
              </div>
            ) : null}
            {zoom !== undefined && savedAt !== undefined ? (
              <div aria-hidden="true" className="h-4 border-l border-line" />
            ) : null}
            {savedAt !== undefined ? (
              <span className={MUTED}>
                <Clock className="h-3 w-3" />
                {savedAt}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </footer>
  );
}
