/**
 * The shell's class strings, in one place.
 *
 * `@hewa/app-shell` writes these out in `ActionGroup`, `TitleBar` and `IconRail`
 * — three copies of the same button. A fourth copy per control would be the same
 * problem again, and worse: a control that does not match the shell's reads as a
 * different application, which is the whole thing the shell was extracted to
 * prevent.
 *
 * They live here rather than in `controls.tsx` because two modules need them —
 * `overlays.tsx` draws a close button that is one of these — and having the
 * overlays import them from the controls would make the two import each other.
 *
 * When the shell consolidates its own three copies into an export, this file
 * re-exports from there and the strings here go away.
 */

/** The shell's button. */
export const BUTTON =
  "inline-flex h-8 items-center justify-center gap-1 rounded-md border border-line bg-surface-raised px-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40";

/** The shell's icon-only button. */
export const ICON_BUTTON =
  "inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface-raised text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40";

/**
 * The same, sized to sit inside a field or a chip.
 *
 * Unbordered, because a border inside another border is a second line rather
 * than a button, and at 24px it is a target inside a 28px one.
 */
export const ICON_BUTTON_SMALL =
  "inline-flex h-6 w-6 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40";

/** A raised chip, the shape the summary bar and the status bar use. */
export const CHIP = "rounded border border-line bg-surface-raised text-xs text-ink-muted";

/** A chip that is on, in the accent. */
export const CHIP_ACTIVE = "rounded border border-accent/40 bg-accent/15 text-xs text-accent";

/** The floating surface: the shell's raised one, with a shadow to lift it. */
export const SURFACE = "rounded-lg border border-line bg-surface-raised shadow-lg shadow-black/10";
