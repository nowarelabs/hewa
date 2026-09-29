import type { ReactElement } from "react";
import { ChevronRight } from "lucide-react";

import type { PanelProps, PanelSpec } from "./types";

const SIDE = {
  left: "border-e",
  right: "border-s",
} as const;

/**
 * One side column, and the collapsed handle that stands in for it.
 *
 * The handle is a real button rather than a decorative div: it is the only way
 * to reopen a panel once collapsed, and a click target a keyboard user cannot
 * reach is a panel they can never get back.
 */
export function SidePanel({
  side,
  open,
  onToggle,
  spec,
  props,
}: {
  side: "left" | "right";
  open: boolean;
  onToggle: () => void;
  spec: PanelSpec;
  props: PanelProps;
}): ReactElement {
  if (!open) {
    return <PanelHandle side={side} onToggle={onToggle} spec={spec} />;
  }

  const { title, render: Content, bodyClassName = "p-4 overflow-y-auto", empty } = spec;

  return (
    <aside className={`flex w-64 shrink-0 flex-col border-line bg-surface ${SIDE[side]}`}>
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

function PanelHandle({
  side,
  onToggle,
  spec,
}: {
  side: "left" | "right";
  onToggle: () => void;
  spec: PanelSpec;
}): ReactElement {
  const label = spec.title ?? "panel";
  return (
    <button
      type="button"
      onClick={onToggle}
      title={`Show ${label}`}
      aria-label={`Show ${label}`}
      className={`flex w-6 shrink-0 cursor-pointer items-center justify-center border-line bg-surface text-ink-faint transition-colors hover:bg-accent hover:text-accent-ink ${SIDE[side]}`}
    >
      <ChevronRight className={`w-4 h-4 ${side === "right" ? "rotate-180" : ""}`} />
    </button>
  );
}
