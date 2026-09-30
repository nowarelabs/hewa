"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ICON_BUTTON, SURFACE } from "./tokens";

/**
 * The things that float above the columns: a popover, a modal, and the menu a
 * dropdown opens.
 *
 * They are one file because they are one problem. A floating panel has to close
 * on Escape, close when the pointer lands outside it, and — for the modal — keep
 * the keyboard inside it while it is open. Written three times, that is three
 * chances to get the first two subtly different from each other, and the bug
 * that lands is the one where a modal traps focus and never gives it back.
 *
 * All three render into a portal on `document.body`. A dropdown inside a panel
 * that scrolls is clipped by it otherwise, and a dropdown that clips is not a
 * dropdown.
 */

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * The newest `value`, held so an effect can read it without re-subscribing.
 *
 * Every handler here is written inline by its caller, so an effect that
 * depended on one would tear down and re-add a document listener on every
 * render of the panel behind it.
 */
function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/**
 * A detached element on `document.body` to render into, or `null` on the server.
 *
 * `null` on the server is not a detail: a modal that renders during SSR
 * produces markup that hydrates into a different tree, and a panel rendered
 * into `document.body` cannot be part of the server's output at all.
 */
export function usePortal(): HTMLElement | null {
  const [node, setNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const element = document.createElement("div");
    element.setAttribute("data-portal", "");
    document.body.appendChild(element);
    setNode(element);
    return () => {
      element.remove();
    };
  }, []);

  return node;
}

/**
 * Closes a floating panel on Escape or on a pointer press outside it.
 *
 * Both listeners sit on `document` and the press one in the capture phase, so a
 * press that a panel inside the floating content would have stopped is still
 * seen here. What is inside is the caller's problem: pass every element that
 * counts as "not outside", which is the trigger as well as the panel, or
 * clicking the button that opened the menu closes it and reopens it.
 */
export function useDismiss(
  active: boolean,
  onDismiss: () => void,
  inside: readonly (HTMLElement | null)[],
): void {
  const dismiss = useLatest(onDismiss);
  const refs = useLatest(inside);

  useEffect(() => {
    if (!active) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") {
        return;
      }
      event.stopPropagation();
      dismiss.current();
    };
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (refs.current.some((element) => element?.contains(target) === true)) {
        return;
      }
      dismiss.current();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [active, dismiss, refs]);
}

/**
 * Keeps Tab inside `element` while it is active, and hands focus back after.
 *
 * Restoring focus is the half that is usually missing. A dialog that takes the
 * keyboard and gives it back to nothing leaves the operator tabbing through the
 * page behind it from the top, and nothing about that looks like a bug.
 *
 * The element is an argument, not a ref to read, and that is the whole point.
 * A panel in a portal does not exist until an effect has created the portal and
 * committed into it, so an effect that reads `ref.current` runs one commit early,
 * finds `null`, and — its dependencies being unchanged by the panel appearing —
 * never runs again. A modal opened by a state change would then trap no focus
 * and restore none, and nothing about that looks like a bug either.
 */
export function useFocusTrap(
  active: boolean,
  element: HTMLElement | null,
  initial?: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!active || element === null) {
      return;
    }
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Read inside the effect, not from the argument's current value: the control
    // being aimed at is in the same commit as the panel, so during the render
    // that revealed the panel it was still `null`.
    const target = initial?.current ?? element.querySelector<HTMLElement>(FOCUSABLE) ?? element;
    target.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Tab") {
        return;
      }
      const focusable = [...element.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const index = focusable.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey ? index - 1 : index + 1;
      if (next >= 0 && next < focusable.length) {
        return;
      }
      event.preventDefault();
      focusable[event.shiftKey ? focusable.length - 1 : 0]?.focus();
    };

    element.addEventListener("keydown", onKeyDown);
    return () => {
      element.removeEventListener("keydown", onKeyDown);
      before?.focus();
    };
  }, [active, element, initial]);
}

/**
 * Positions a floating surface under the element that opened it.
 *
 * `fixed` coordinates come from the trigger's rect rather than from CSS, because
 * a panel that scrolls moves the trigger and a `top-full` menu stays where it
 * was. Repositioned on scroll and resize as well as on open.
 */
export function useAnchorPosition(
  anchor: HTMLElement | null,
  active: boolean,
  align: "start" | "end" = "start",
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (!active) {
      return;
    }
    const place = (): void => {
      const rect = anchor?.getBoundingClientRect();
      if (rect === undefined) {
        return;
      }
      setStyle({
        top: rect.bottom,
        left: align === "start" ? rect.left : rect.right,
        minWidth: rect.width,
      });
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [active, anchor, align]);

  return style;
}

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** The element the panel sits against. */
  anchor: RefObject<HTMLElement | null>;
  children: ReactNode;
  /** Names the panel for a screen reader; the row of buttons is not enough. */
  label: string;
  className?: string;
  align?: "start" | "end";
}

/**
 * A panel that floats against a trigger, for a set of links or switches that
 * would not fit in the flow.
 *
 * Not a dialog: a popover is a non-modal extension of what is already on screen,
 * so the page behind it stays reachable and does not get `aria-modal`.
 */
export function Popover({
  open,
  onClose,
  anchor,
  children,
  label,
  className = "",
  align = "start",
}: PopoverProps): ReactNode {
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const trigger = anchor.current;
  const style = useAnchorPosition(trigger, open, align);
  useDismiss(open, onClose, [trigger, panel]);
  const portal = usePortal();

  if (!open || portal === null) {
    return null;
  }

  return createPortal(
    <div
      ref={setPanel}
      role="dialog"
      aria-label={label}
      style={style}
      className={`fixed z-50 ${SURFACE} p-1 ${className}`}
    >
      {children}
    </div>,
    portal,
  );
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: ReactNode;
  children?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Focused instead of the first control, when one control is the point. */
  initialFocus?: RefObject<HTMLElement | null>;
}

const MODAL_SIZE = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" } as const;

/**
 * A dialog that takes the keyboard while it is open.
 *
 * `aria-modal` is what makes a screen reader read the dialog instead of the page
 * behind it, and it is a promise: nothing outside may be reachable while it
 * holds. The backdrop click closes it, Escape closes it, and closing hands
 * focus back to whatever opened it.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  size = "md",
  initialFocus,
}: ModalProps): ReactNode {
  const [dialog, setDialog] = useState<HTMLDivElement | null>(null);
  useFocusTrap(open, dialog, initialFocus);
  useDismiss(open, onClose, [dialog]);
  const titleId = useId();
  const descriptionId = useId();
  const portal = usePortal();

  if (!open || portal === null) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div data-modal-backdrop="" onClick={onClose} className="absolute inset-0 bg-canvas/60" />
      <div
        ref={setDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description === undefined ? undefined : descriptionId}
        className={`relative flex max-h-full w-full flex-col ${MODAL_SIZE[size]} ${SURFACE}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line p-4">
          <div>
            <h2 id={titleId} className="text-sm font-semibold text-ink">
              {title}
            </h2>
            {description === undefined ? null : (
              <p id={descriptionId} className="mt-1 text-xs text-ink-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`${ICON_BUTTON} -m-1 shrink-0 border-transparent`}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>

        {footer === undefined ? null : (
          <footer className="flex justify-end gap-2 border-t border-line p-3">{footer}</footer>
        )}
      </div>
    </div>,
    portal,
  );
}
