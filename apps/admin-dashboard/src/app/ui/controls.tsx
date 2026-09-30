"use client";

import { useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useAnchorPosition, useDismiss, usePortal } from "./overlays";
import { BUTTON, CHIP, CHIP_ACTIVE, ICON_BUTTON_SMALL, SURFACE } from "./tokens";

/**
 * The controls that sit in a panel's own row: a search field, filters, and the
 * menu a dropdown opens.
 *
 * The class strings they are built from are the shell's, declared once in
 * `./tokens` rather than here: `@hewa/app-shell` has the same button written out
 * three times already, and a fourth copy is how two panels end up looking like
 * two applications.
 */

/**
 * Whether a row matches a search box.
 *
 * A `toLowerCase` substring test, and that is all it claims to be: no stemming,
 * no ranking, no typo tolerance. `trim` because a trailing space in a copied
 * query should not silently return nothing, and the empty query matches
 * everything so a caller does not have to special-case clearing the field.
 */
export function matchesQuery(query: string, ...fields: readonly string[]): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") {
    return true;
  }
  return fields.some((field) => field.toLowerCase().includes(needle));
}

/** Adds a value to a list of them, or takes it out if it is already there. */
export function toggleValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

/**
 * Where a menu's highlight goes next, for a key press.
 *
 * Wraps, and stays put for anything that is not navigation, so a caller can pass
 * every key through and compare the result with the current index. A list of
 * options with no highlight in it is a list of buttons, and the screen reader
 * announces it that way.
 */
export function nextIndex(current: number, count: number, key: string): number {
  if (count === 0) {
    return -1;
  }
  const from = current < 0 ? (key === "ArrowUp" ? 0 : -1) : current;
  if (key === "ArrowDown") {
    return (from + 1) % count;
  }
  if (key === "ArrowUp") {
    return (from <= 0 ? count : from) - 1;
  }
  if (key === "Home") {
    return 0;
  }
  if (key === "End") {
    return count - 1;
  }
  return current;
}

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Called on Enter. Omit it and Enter does nothing rather than submitting. */
  onSubmit?: (value: string) => void;
  placeholder?: string;
  /** Announced and shown. Always labelled, labelled or not. */
  label?: string;
  /** Text inside the field on the right: a result count, or "No matches". */
  hint?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * A search box with a clear button and a hint slot.
 *
 * The hint is inside the field rather than beside it so that "12 results" cannot
 * wrap onto the next line and change the height of a row every other panel's
 * header is aligned with. Escape clears it, which is the one key every search
 * box is expected to answer to and the one most of them do not.
 */
export function SearchField({
  value,
  onChange,
  onSubmit,
  placeholder = "Search",
  label,
  hint,
  disabled = false,
  className = "",
}: SearchFieldProps): ReactElement {
  const inputId = useId();
  const field = useRef<HTMLInputElement>(null);

  return (
    <div role="search" className={`relative min-w-0 ${className}`}>
      <label htmlFor={inputId} className="sr-only">
        {label ?? placeholder}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
      />
      <input
        ref={field}
        id={inputId}
        type="text"
        role="searchbox"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value !== "") {
            event.preventDefault();
            onChange("");
            return;
          }
          if (event.key === "Enter") {
            onSubmit?.(value);
          }
        }}
        className={`h-8 w-full rounded-md border border-line bg-surface-raised pl-8 text-sm text-ink placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40 ${
          value === "" ? "pr-2" : "pr-16"
        }`}
      />
      {value === "" && hint !== undefined ? (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ink-faint">
          {hint}
        </span>
      ) : null}
      {value === "" ? null : (
        <>
          {hint === undefined ? null : (
            <span className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 text-xs text-ink-faint">
              {hint}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              onChange("");
              field.current?.focus();
            }}
            aria-label="Clear search"
            className={`${ICON_BUTTON_SMALL} absolute right-1 top-1/2 -translate-y-1/2`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

/**
 * A row of filter toggles.
 *
 * `aria-pressed` rather than a checkbox, because a filter chip is a button that
 * stays where it is and a checkbox brings a box that means nothing here. The
 * group is labelled, so the row is not announced as a list of unlabelled
 * buttons.
 */
export interface FilterBarProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function FilterBar({ label, children, className = "" }: FilterBarProps): ReactElement {
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex flex-wrap items-center gap-1 ${className}`}
    >
      {children}
    </div>
  );
}

export interface FilterToggleProps {
  label: string;
  pressed: boolean;
  onToggle: () => void;
  /** A count to show after the label: how many rows the filter would leave. */
  count?: number;
  disabled?: boolean;
  /**
   * The group this toggle filters on, rendered as `data-summary-item`.
   *
   * The value matters to the caller and not to this component — it is what comes
   * back on `onToggle` — so it is the caller's key, not a label. A summary bar
   * passes each group's own key, which is what lets a bar's chips and a bar's
   * toggles be found by the same name.
   */
  group?: string;
  /**
   * The view's own colour for this group, in place of the neutral chip.
   *
   * A severity bar is a severity bar because red and orange mean something here.
   * Pressing a chip that loses its colour turns the one row of chips that can be
   * read at a glance into a row of blue ones that cannot.
   */
  tint?: string;
}

export function FilterToggle({
  label,
  pressed,
  onToggle,
  count,
  disabled = false,
  group,
  tint,
}: FilterToggleProps): ReactElement {
  return (
    <button
      type="button"
      data-summary-item={group}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onToggle}
      className={`inline-flex h-7 items-center gap-1.5 px-2 transition-colors focus-visible:outline-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40 ${
        tint ?? (pressed ? CHIP_ACTIVE : CHIP)
      } ${
        pressed && tint !== undefined
          ? // A tinted chip is already the accent's colour, so being pressed is
            // said with weight and a ring instead of with a hue change.
            "ring-1 ring-current"
          : "hover:bg-surface-sunken hover:text-ink"
      }`}
    >
      {label}
      {count === undefined ? null : <span className="tabular-nums">{count}</span>}
    </button>
  );
}

export interface ActiveFiltersProps {
  /** The filters in force, as chips the reader can take off one at a time. */
  items: readonly { id: string; label: string }[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
  label?: string;
  className?: string;
}

/**
 * The filters in force, each removable, and a way to take all of them off.
 *
 * Separate from {@link FilterBar} because it answers a different question. The
 * bar is every filter that exists; this is the two that are on, and a list of
 * every filter stays on screen after the panel it filters is closed.
 */
export function ActiveFilters({
  items,
  onRemove,
  onClearAll,
  label = "Active filters",
  className = "",
}: ActiveFiltersProps): ReactElement {
  if (items.length === 0) {
    return <></>;
  }
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex flex-wrap items-center gap-1 ${className}`}
    >
      {items.map((item) => (
        <span
          key={item.id}
          className={`${CHIP_ACTIVE} inline-flex h-7 items-center gap-1 pl-2 pr-1`}
        >
          {item.label}
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label={`Remove filter ${item.label}`}
            className={`${ICON_BUTTON_SMALL} h-5 w-5 hover:bg-accent/20`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className={`${CHIP} h-7 px-2 transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-accent`}
      >
        Clear all
      </button>
    </div>
  );
}

export interface DropdownOption {
  value: string;
  label: string;
  /** A second line, e.g. what selecting this would leave. */
  hint?: string;
  disabled?: boolean;
}

export interface DropdownProps {
  /** The current value, or `null` for nothing selected. */
  value: string | null;
  options: readonly DropdownOption[];
  onSelect: (value: string) => void;
  label: string;
  /** What the trigger says with nothing selected. */
  placeholder?: string;
  disabled?: boolean;
  align?: "start" | "end";
  className?: string;
}

/**
 * A trigger and a list of options.
 *
 * A listbox and not a menu of buttons: the reader is choosing one of a set, so
 * the set is announced, the current one is announced, and the arrow keys move
 * the highlight through it. The menu is a portal, because every panel in this app
 * scrolls and a menu that is clipped by its own panel is a menu with half its
 * options in it.
 */
export function Dropdown({
  value,
  options,
  onSelect,
  label,
  placeholder = "Select",
  disabled = false,
  align = "start",
  className = "",
}: DropdownProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [menu, setMenu] = useState<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const style = useAnchorPosition(trigger.current, open, align);
  const portal = usePortal();

  useEffect(() => {
    if (!open) {
      setActive(-1);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      menu?.focus();
    }
  }, [open, menu]);

  /**
   * Closing from the keyboard hands focus back to the trigger; closing because
   * the pointer landed elsewhere does not, or clicking into the next panel
   * yanks the caret back out of it. The difference is whether the menu had
   * focus when it closed, which is the whole question.
   */
  const close = (restoreFocus: boolean): void => {
    setOpen(false);
    if (restoreFocus) {
      trigger.current?.focus();
    }
  };

  useDismiss(open, () => close(menu?.contains(document.activeElement) === true), [
    trigger.current,
    menu,
  ]);

  const current = options.find((option) => option.value === value);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive((was) => nextIndex(was, options.length, event.key));
          }
        }}
        className={`${BUTTON} justify-between gap-2 ${className}`}
      >
        <span className="truncate">{current?.label ?? placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
      </button>

      {open && portal !== null
        ? createPortal(
            <div
              ref={setMenu}
              id={listId}
              role="listbox"
              aria-label={label}
              style={style}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  const option = options[active];
                  if (option === undefined || option.disabled === true) {
                    return;
                  }
                  event.preventDefault();
                  onSelect(option.value);
                  close(true);
                  return;
                }
                setActive((was) => nextIndex(was, options.length, event.key));
              }}
              className={`${SURFACE} fixed z-50 overflow-auto py-1 focus-visible:outline-2 focus-visible:outline-accent`}
            >
              {options.map((option, index) => {
                const selected = option.value === value;
                return (
                  <div
                    key={option.value}
                    role="option"
                    aria-selected={selected}
                    aria-disabled={option.disabled === true}
                    onClick={() => {
                      if (option.disabled === true) {
                        return;
                      }
                      onSelect(option.value);
                      close(true);
                    }}
                    onMouseEnter={() => setActive(index)}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm ${
                      option.disabled === true
                        ? "cursor-not-allowed text-ink-faint"
                        : index === active
                          ? "bg-surface-sunken text-ink"
                          : "text-ink-muted"
                    }`}
                  >
                    <Check
                      aria-hidden="true"
                      className={`h-3.5 w-3.5 shrink-0 text-accent ${selected ? "" : "invisible"}`}
                    />
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {option.hint === undefined ? null : (
                      <span className="shrink-0 text-xs text-ink-faint tabular-nums">
                        {option.hint}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>,
            portal,
          )
        : null}
    </>
  );
}
