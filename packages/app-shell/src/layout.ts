import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Whether the shell has room for columns or has to make one of them a sheet.
 *
 * `md` is the same line the title bar splits on, and it is measured rather than
 * assumed: a shell at 500px and a shell at 1920px have different answers to
 * "where does the left panel go", and a package that guessed would be wrong for
 * somebody.
 *
 * ## Why the first render says "column"
 *
 * The server cannot know the viewport, and rendering a sheet on the server would
 * put a phone's markup in the HTML it hydrates. So the initial value is `"column"`
 * on both sides, which means hydration compares like with like, and the correction
 * happens in a **layout** effect — before the browser paints, so a phone sees the
 * sheet state arrive with no frame of squeezed column in between. `useEffect` would
 * be one paint later, which on this particular change is exactly the flash of a
 * 256px column shoving the table off a 375px screen.
 */
export type ShellLayout = "column" | "sheet";

/** The same breakpoint as `md:` in `TitleBar`, so both layouts agree. */
export const WIDE_VIEWPORT = "(min-width: 768px)";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * `"column"` above the breakpoint, `"sheet"` below it, and whether the reader has
 * been across the line since this shell mounted.
 *
 * Narrow is the interesting half: three fixed columns and a rail cannot share a
 * phone, so below the line each panel becomes a sheet over the main column rather
 * than a column beside it. That is a change of *presentation* rather than of which
 * panel is open — see `SheetSide` for the state half, which is deliberately not in
 * the URL.
 *
 * `crossed` is the one thing here that is not a layout. It separates a phone's
 * opening frame from a desktop window that later shrank, and the sheet state needs
 * the difference: the first must not arrive with a sheet open, and the second must
 * not throw away a panel the reader had open when the window moved. Only the hook
 * that owns the measurement can know which of the two happened.
 */
export function useShellLayout(): { layout: ShellLayout; crossed: boolean } {
  const [layout, setLayout] = useState<ShellLayout>("column");
  const [crossed, setCrossed] = useState(false);
  // The layout as last measured. `null` until the first one, which is what tells a
  // phone's opening frame apart from a window that later moved under the reader.
  const measured = useRef<ShellLayout | null>(null);

  useIsomorphicLayoutEffect(() => {
    const query = window.matchMedia(WIDE_VIEWPORT);
    const measure = (): void => {
      const next: ShellLayout = query.matches ? "column" : "sheet";
      const previous = measured.current;
      measured.current = next;
      setLayout(next);
      setCrossed(previous !== null && previous !== next);
    };
    measure();
    query.addEventListener("change", measure);
    return () => query.removeEventListener("change", measure);
  }, []);

  return { layout, crossed };
}

/** Which side a panel is on, as the state and the toggles name them. */
export type PanelSide = "left" | "right" | "assistant";

/**
 * The open sheet on a narrow screen, or `null` when none is.
 *
 * Deliberately not in the URL, and that is the load-bearing decision in the whole
 * narrow layout. `panels.left` is in the URL because a column's width is part of
 * what a link describes; a sheet is not, because it is an overlay on a screen that
 * has room for exactly one thing, and `?left=1` arriving on a phone would cover
 * the table the left panel exists to filter. The mobile menu already works this
 * way. So a link sent from a desktop opens with no sheet at all, and closing a
 * sheet does not write to the address bar.
 */
export type SheetSide = PanelSide | null;
