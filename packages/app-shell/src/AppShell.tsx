import type { ReactElement, ReactNode } from "react";

import { IconRail } from "./IconRail";
import { hasAssistant, resolveItem, resolveView } from "./resolve";
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
      defaultItem={null}
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
  const { view, item, panels, togglePanel, theme } = useShellState();

  const resolved = resolveView(config, view);
  const active = resolveItem(resolved.rail, item);
  const activeId = active?.id ?? null;
  const panelProps: PanelProps = { view, item: activeId, theme };

  return (
    <div className={`${theme} h-screen overflow-hidden`} data-shell-theme={theme}>
      <div className="flex h-full flex-col bg-canvas text-ink">
        <TitleBar
          brand={config.brand}
          actions={config.actions ?? []}
          views={config.views}
          hasAssistant={resolved.assistant !== undefined}
        />
        <div className="flex min-h-0 flex-1">
          <IconRail items={resolved.rail} activeId={active?.id ?? null} />
          {active !== null ? (
            <SidePanel
              side="left"
              open={panels.left}
              onToggle={() => togglePanel("left")}
              spec={active.panel}
              props={panelProps}
            />
          ) : null}
          <main className="flex min-w-0 flex-1 flex-col">
            <PanelHost spec={resolved.main} props={panelProps} />
            {children}
          </main>
          <SidePanel
            side="right"
            open={panels.right}
            onToggle={() => togglePanel("right")}
            spec={resolved.right}
            props={panelProps}
          />
          {resolved.assistant !== undefined ? (
            <SidePanel
              side="right"
              open={panels.assistant}
              onToggle={() => togglePanel("assistant")}
              spec={resolved.assistant}
              props={panelProps}
            />
          ) : null}
        </div>
        <StatusBar spec={resolved.status ?? {}} />
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
