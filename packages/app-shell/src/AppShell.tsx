import { useEffect, useRef } from "react";
import type { ReactElement, ReactNode } from "react";

import { IconRail } from "./IconRail";
import { hasAssistant, resolveContent, resolveItem, resolveView } from "./resolve";
import { ShellStateProvider, useShellState } from "./state";
import { SidePanel } from "./SidePanel";
import { StatusBar } from "./StatusBar";
import { TitleBar } from "./TitleBar";
import type { PanelProps, PanelSpec, ShellConfig, ShellTheme } from "./types";

/**
 * The whole shell. An app renders this and nothing else.
 *
 * The `.dark` class goes on the shell's own root rather than on `<html>`, so
 * two shells on one page would not fight over the document, and so the palette
 * the app already defines in its own `globals.css` is not clobbered by a
 * console that only wants to change its own chrome.
 */
export function AppShell({
  config,
  onThemeChange,
  children,
}: {
  config: ShellConfig;
  onThemeChange?: (theme: ShellTheme) => void;
  /** Appended inside the main column, below the view's own content. */
  children?: ReactNode;
}): ReactElement {
  return (
    <ShellStateProvider
      syncUrl={config.syncUrl ?? false}
      defaultView={config.defaultView}
      defaultTheme={config.theme ?? "dark"}
      hasAssistant={hasAssistant(config.views)}
      onThemeChange={onThemeChange}
    >
      <ShellBody config={config}>{children}</ShellBody>
    </ShellStateProvider>
  );
}

function ShellBody({
  config,
  children,
}: {
  config: ShellConfig;
  children?: ReactNode;
}): ReactElement {
  const { view, section, layout, panels, sheet, togglePanel, closeSheet, theme } = useShellState();
  // One bar at the top, or the same bar at the bottom. Which is decided here
  // rather than in either of them, because it is a decision about the viewport
  // that both of them would otherwise have to make for themselves.
  const compact = layout === "sheet";

  const resolved = resolveView(config, view);
  const active = resolveItem(resolved.rail, section);
  const content = resolveContent(resolved, active);
  const panelProps: PanelProps = { view, section: active?.id ?? null, theme };

  // A sheet is dismissed by leaving the destination it was opened for, and by
  // Escape. Both are here rather than in `SidePanel` because either applies to the
  // column layout too — a panel the reader opened over a phone screen has the same
  // claim on their attention as one that was there all along — and because the
  // navigation case has to be watched from outside the panel that would be closed.
  //
  // The first run is skipped rather than treated as a navigation to the destination
  // the reader is already on. Closing on arrival is not free: it marks the sheet as
  // the reader's own business rather than the columns', which is what tells a shell
  // that later shrinks to keep a panel open as one that dismissed it on the way in.
  const destination = `${view}/${active?.id ?? ""}`;
  const arrived = useRef(destination);
  useEffect(() => {
    if (arrived.current === destination) return;
    arrived.current = destination;
    closeSheet();
  }, [destination, closeSheet]);

  useEffect(() => {
    if (sheet === null) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") closeSheet();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sheet, closeSheet]);

  return (
    // `data-shell-layout` is the shell's measured answer to "does this viewport
    // have room for columns", published so the stylesheet can key off it rather
    // than restating the breakpoint as a media query of its own.
    //
    // `group` is what lets a panel reach it: `group-data-[shell-layout=sheet]:…`
    // is a panel saying what it does on a narrow screen without writing 768px, and
    // without deciding the breakpoint itself. A panel that hid itself with its own
    // `@media` would be a third reading of the width, in a component that has no way
    // to know whether the shell measured one yet.
    <div
      className={`${theme} group h-screen overflow-hidden`}
      data-shell-theme={theme}
      data-shell-layout={layout}
    >
      <div className="flex h-full flex-col bg-canvas text-ink">
        {/* One title bar at every width. The view tabs leave it on a narrow screen
            and reappear in the status bar, because that is the one control under
            the reader's thumb is worth the trip for; the toggles, the theme switch
            and the account corner stay, so the bar keeps the row of controls a
            reader already knows. `StatusBar` takes its own clusters over for the
            tabs, and the ones that were actions move into the menu. */}
        <TitleBar
          brand={config.brand}
          actions={config.actions ?? []}
          statusActions={compact ? (content.status?.actions ?? []) : []}
          views={config.views}
          left={content.left}
          hasAssistant={content.assistant !== undefined}
        />
        <div className="relative flex min-h-0 flex-1">
          {sheet === null ? null : (
            <button
              type="button"
              // The scrim is how a sheet is dismissed on a screen with no Escape
              // key, and it is a button so that a reader who reaches it with a
              // keyboard or a screen reader gets a target rather than a dead
              // overlay. Labelled by what it does, since it has nothing to show.
              aria-label="Close panel"
              onClick={closeSheet}
              data-shell-scrim=""
              className="absolute inset-0 z-30 cursor-default bg-canvas/70 backdrop-blur-[1px]"
            />
          )}
          <IconRail items={resolved.rail} activeId={active?.id ?? null} />
          {/* Unconditional: every destination declares a `left` column, so the
              layout is the same at every rail position. */}
          <SidePanel
            side="left"
            open={panels.left}
            layout={layout}
            onToggle={() => togglePanel("left")}
            spec={content.left}
            props={panelProps}
          />
          <main className="flex min-w-0 flex-1 flex-col">
            <PanelHost spec={content.main} props={panelProps} />
            {children}
          </main>
          {content.right === undefined ? null : (
            <SidePanel
              side="right"
              open={panels.right}
              layout={layout}
              onToggle={() => togglePanel("right")}
              spec={content.right}
              props={panelProps}
            />
          )}
          {content.assistant === undefined ? null : (
            <SidePanel
              side="assistant"
              open={panels.assistant}
              layout={layout}
              onToggle={() => togglePanel("assistant")}
              spec={content.assistant}
              props={panelProps}
            />
          )}
        </div>
        <StatusBar spec={content.status ?? {}} views={compact ? config.views : undefined} />
      </div>
    </div>
  );
}

function PanelHost({ spec, props }: { spec: PanelSpec; props: PanelProps }): ReactElement {
  const Content = spec.render;
  return (
    <div className={spec.bodyClassName ?? "min-h-0 flex-1 overflow-hidden"}>
      {spec.empty ? null : <Content {...props} />}
    </div>
  );
}
