import type { ReactElement } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { PanelSide, ShellLayout } from "./layout";
import type { PanelProps, PanelSpec } from "./types";

/**
 * A column beside the main one, and the collapsed handle that stands in for it.
 *
 * `side` is not decoration. A column left of the main one has its rule on its
 * right and its handle opens towards the right, and getting either backwards
 * makes the handle look like it belongs to the column on its other side — which
 * is how a reader reopens the wrong panel and concludes the shell is broken.
 *
 * The handle is a real button rather than a decorative div: on a wide screen it is
 * the only way to reopen a panel once collapsed, and a click target a keyboard
 * user cannot reach is a panel they can never get back.
 *
 * ## A sheet has no handle
 *
 * A closed sheet renders nothing at all, so the main column gets the width a
 * handle would have taken — 24px of a 320px screen, or 36px if it were given the
 * target size a sheet once had. The title bar's own toggle opens the panel on that
 * layout and is named after what the panel holds, so the handle would be a second
 * control for one panel, in the one place on the screen that is worth the space.
 * The title bar keeps it on a wide screen, where it is the only way back and the
 * reader has the width to spare.
 *
 * ## One element, two layouts
 *
 * `layout` changes the classes and nothing else. The same `<aside>` is rendered
 * either way, so a panel holding state survives the crossing — which matters for
 * the panels that hold more than a filter: a create-or-update panel with a typed-in
 * value, or a search with a half-written term, is thrown away by a remount when
 * the reader rotates a phone. Sizing it as a sheet rather than as a column is the
 * difference; so is deciding which of the two it is in the shell state rather than
 * in here.
 */
export function SidePanel({
  side,
  open,
  layout,
  onToggle,
  spec,
  props,
}: {
  side: PanelSide;
  open: boolean;
  layout: ShellLayout;
  onToggle: () => void;
  spec: PanelSpec;
  props: PanelProps;
}): ReactElement {
  const isSheet = layout === "sheet";

  // Nothing, rather than a handle: the toggle in the title bar opens the sheet, and
  // the strip a handle would occupy is content. See "A sheet has no handle" above.
  if (!open && isSheet) {
    return <></>;
  }

  if (!open) {
    return <PanelHandle side={side} onToggle={onToggle} spec={spec} />;
  }

  const { title, render: Content, bodyClassName = "p-4 overflow-y-auto", empty } = spec;
  const isLeft = side === "left";
  // A sheet is anchored to its own edge and floats above the main column; a
  // column is in the flow and takes its width from it. `max-w-[85vw]` rather than
  // a fixed width so a sheet on a 320px phone still leaves a strip of the content
  // visible, which is what tells the reader they are looking at an overlay.
  const placement = isSheet
    ? `absolute inset-y-0 z-40 w-72 max-w-[85vw] shadow-2xl ${isLeft ? "left-0" : "right-0"}`
    : `w-64 shrink-0`;

  return (
    <aside
      className={`flex flex-col border-line bg-surface ${placement} ${isLeft ? "border-r" : "border-s"}`}
      data-panel-side={side}
      data-panel-layout={layout}
    >
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

/**
 * A collapsed column, as one pressable strip.
 *
 * Column-only — see "A sheet has no handle" — so there is no layout to read and no
 * wider variant to size.
 */
function PanelHandle({
  side,
  onToggle,
  spec,
}: {
  side: PanelSide;
  onToggle: () => void;
  spec: PanelSpec;
}): ReactElement {
  const label = spec.title ?? "panel";
  const isLeft = side === "left";
  const Glyph = isLeft ? ChevronRight : ChevronLeft;

  return (
    <button
      type="button"
      onClick={onToggle}
      title={`Show ${label}`}
      aria-label={`Show ${label}`}
      // The same marker the open panel carries, because the two are the same
      // panel: without it a collapsed column is the only part of the shell with no
      // way to say which side it is, and `aria-label` alone cannot tell a left
      // handle from a right one when both are collapsed.
      data-panel-side={side}
      className={`flex w-6 shrink-0 cursor-pointer items-center justify-center border-line bg-surface text-ink-faint transition-colors hover:bg-accent hover:text-accent-ink ${isLeft ? "border-r" : "border-s"}`}
    >
      <Glyph className="w-4 h-4" />
    </button>
  );
}
