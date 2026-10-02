import type { ReactElement } from "react";
import { Clock, Maximize2, ZoomIn, ZoomOut } from "lucide-react";

import { ActionGroup } from "./ActionGroup";
import { useShellState } from "./state";
import { ViewTabs } from "./ViewTabs";
import type { StatusSpec, ViewSpec } from "./types";

const PILL =
  "inline-flex h-7 items-center justify-center rounded border border-line bg-surface-raised px-2 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink disabled:pointer-events-none disabled:opacity-40";

const MUTED = "flex items-center gap-1 text-xs text-ink-faint";

/**
 * The tabs, at the bottom of the screen.
 *
 * {@link ViewTabs} rather than a second strip written for this bar: the two must
 * agree about which view is open and what a view is called, and the bar nobody
 * looks at is the one that quietly disagrees.
 */
function NarrowTabs({ views }: { views: Record<string, ViewSpec> }): ReactElement {
  const { view, selectView } = useShellState();
  return <ViewTabs entries={Object.entries(views)} active={view} onSelect={selectView} fill />;
}

/**
 * The bottom chrome: the view tabs on a narrow screen, and the current view's
 * message, actions, counters, zoom and save stamp on a wide one.
 *
 * `views` is set only on a narrow viewport, and then this bar is the tabs and
 * nothing else. It replaces the clusters rather than joining them: on a phone the
 * two do not both fit, and the tabs are the control a reader cannot reach any
 * other way — a status line saying which section is open is the same information
 * as the selected tab, and the tab is the thing that changes it. So the clusters
 * are hidden rather than stacked under it, and anything they held that cannot be
 * reached another way moves into the title bar's menu.
 *
 * Every cluster is optional and rendered only when the view declares it. The
 * previous version had an either/or between the action buttons and the counter
 * row, and because every view declared actions, the counter row was
 * unreachable and the zoom cluster defaulted to a dead `100%`.
 */
export function StatusBar({
  spec,
  views,
}: {
  spec: StatusSpec;
  /**
   * Every view the app declares, on a viewport too narrow to carry them in the
   * title bar. `undefined` on a wide one, and then this renders `spec` as it
   * always did.
   */
  views?: Record<string, ViewSpec>;
}): ReactElement {
  const { message, actions = [], stats = [], zoom, savedAt } = spec;
  const hasLeft = message !== undefined || actions.length > 0 || stats.length > 0;
  const hasRight = zoom !== undefined || savedAt !== undefined;

  if (views !== undefined) {
    return (
      <footer
        data-shell-status=""
        data-shell-status-role="nav"
        // A little inset, not none and not a rem. Flush to both edges the strip
        // reads as a control somebody has stretched; a rem of padding on each side
        // puts the tabs back inside a gutter they no longer need, which is the
        // status line's padding rather than a bar of its own.
        className="border-t border-line bg-surface px-1.5 py-1.5"
      >
        <NarrowTabs views={views} />
      </footer>
    );
  }

  if (!hasLeft && !hasRight) {
    return <div aria-hidden="true" className="h-8 border-t border-line bg-canvas" />;
  }

  return (
    <footer
      data-shell-status=""
      data-shell-status-role="status"
      className="border-t border-line bg-canvas"
    >
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
