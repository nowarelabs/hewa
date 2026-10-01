import type { ReactElement } from "react";
import { ChevronLeft } from "lucide-react";

import type { PanelProps, PanelSpec } from "./types";

/**
 * The column right of the main one, and the collapsed handle that stands in for
 * it.
 *
 * There is only one of these. The shell used to render a left column holding the
 * selected rail item's own panel, which is the one piece of chrome that only
 * makes sense if a rail item is a filter; a destination owns the main column, so
 * the column beside it is detail about that destination and nothing else.
 *
 * The handle is a real button rather than a decorative div: it is the only way
 * to reopen a panel once collapsed, and a click target a keyboard user cannot
 * reach is a panel they can never get back.
 */
export function SidePanel({
  open,
  onToggle,
  spec,
  props,
}: {
  open: boolean;
  onToggle: () => void;
  spec: PanelSpec;
  props: PanelProps;
}): ReactElement {
  if (!open) {
    return <PanelHandle onToggle={onToggle} spec={spec} />;
  }

  const { title, render: Content, bodyClassName = "p-4 overflow-y-auto", empty } = spec;

  return (
    <aside className="flex w-64 shrink-0 flex-col border-s border-line bg-surface">
      {title ? (
        <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
          <h2 className="truncate text-sm font-medium text-ink">{title}</h2>
          <button
            type="button"
            onClick={onToggle}
            aria-label={`Collapse ${title} panel`}
            className="text-xs text-ink-muted transition-colors hover:text-ink"
          >
            Collapse
          </button>
        </header>
      ) : null}
      <div className={bodyClassName}>{empty ? null : <Content {...props} />}</div>
    </aside>
  );
}

function PanelHandle({ onToggle, spec }: { onToggle: () => void; spec: PanelSpec }): ReactElement {
  const label = spec.title ?? "panel";
  return (
    <button
      type="button"
      onClick={onToggle}
      title={`Show ${label}`}
      aria-label={`Show ${label}`}
      className="flex w-6 shrink-0 cursor-pointer items-center justify-center border-s border-line bg-surface text-ink-faint transition-colors hover:bg-accent hover:text-accent-ink"
    >
      <ChevronLeft className="w-4 h-4" />
    </button>
  );
}
