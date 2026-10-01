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
  const { view, section, panels, togglePanel, theme } = useShellState();

  const resolved = resolveView(config, view);
  const active = resolveItem(resolved.rail, section);
  const content = resolveContent(resolved, active);
  const panelProps: PanelProps = { view, section: active?.id ?? null, theme };

  return (
    <div className={`${theme} h-screen overflow-hidden`} data-shell-theme={theme}>
      <div className="flex h-full flex-col bg-canvas text-ink">
        <TitleBar
          brand={config.brand}
          actions={config.actions ?? []}
          views={config.views}
          hasAssistant={content.assistant !== undefined}
        />
        <div className="flex min-h-0 flex-1">
          <IconRail items={resolved.rail} activeId={active?.id ?? null} />
          <main className="flex min-w-0 flex-1 flex-col">
            <PanelHost spec={content.main} props={panelProps} />
            {children}
          </main>
          {content.right === undefined ? null : (
            <SidePanel
              open={panels.right}
              onToggle={() => togglePanel("right")}
              spec={content.right}
              props={panelProps}
            />
          )}
          {content.assistant === undefined ? null : (
            <SidePanel
              open={panels.assistant}
              onToggle={() => togglePanel("assistant")}
              spec={content.assistant}
              props={panelProps}
            />
          )}
        </div>
        <StatusBar spec={content.status ?? {}} />
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
