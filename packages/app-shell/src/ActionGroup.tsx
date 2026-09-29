import type { ReactElement } from "react";

import type { ShellAction } from "./types";

const ICON_BUTTON =
  "inline-flex items-center justify-center h-8 w-8 rounded-md border border-line bg-surface-raised text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40";

const LABEL_BUTTON =
  "inline-flex items-center justify-center gap-2 h-8 px-3 rounded-md border border-line bg-surface-raised text-sm font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40";

/**
 * Renders the app's own title-bar buttons.
 *
 * The separators are drawn from `group` rather than from the position in the
 * array, so inserting a button in the middle of a cluster does not silently
 * move a rule to the other side of it.
 */
export function ActionGroup({
  actions,
  size,
}: {
  actions: ShellAction[];
  size: "icon" | "label";
}): ReactElement {
  return (
    <>
      {actions.map((action, index) => {
        const Icon = action.icon;
        const previous = actions[index - 1];
        const separated = action.group !== undefined && action.group !== previous?.group;
        const button = (
          <button
            key={action.id}
            type="button"
            title={action.label}
            aria-label={action.label}
            disabled={action.disabled ?? false}
            onClick={action.onSelect}
            className={size === "icon" || !action.showLabel ? ICON_BUTTON : LABEL_BUTTON}
          >
            <Icon className="w-4 h-4" />
            {action.showLabel ? <span className="hidden lg:inline">{action.label}</span> : null}
          </button>
        );

        if (!separated) {
          return button;
        }

        return (
          <span key={action.id} className="flex items-center gap-2">
            <span aria-hidden="true" className="h-6 border-l border-line" />
            {button}
          </span>
        );
      })}
    </>
  );
}
