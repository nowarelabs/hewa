import { useState } from "react";
import type { ReactElement } from "react";
import { LayoutGrid, Menu, Moon, PanelRightClose, Settings, Sparkles, Sun } from "lucide-react";

import { ActionGroup } from "./ActionGroup";
import { useShellState } from "./state";
import type { BrandSpec, ShellAction, ViewSpec } from "./types";

const ICON_BUTTON =
  "inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface-raised text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40";

/**
 * The top chrome: identity, the app's own buttons, the view tabs, the panel
 * toggles, the theme switch, and the account corner.
 *
 * Both the wide and the narrow layouts are generated from the same `views`
 * record. The narrow menu used to be a hand-written list of seven buttons with
 * its own labels, which is how the two layouts came to disagree about what a
 * view was called.
 */
export function TitleBar({
  brand,
  actions,
  views,
  hasAssistant,
}: {
  brand: BrandSpec;
  actions: ShellAction[];
  views: Record<string, ViewSpec>;
  hasAssistant: boolean;
}): ReactElement {
  const { view, selectView, panels, togglePanel, theme, setTheme } = useShellState();
  const [menuOpen, setMenuOpen] = useState(false);
  const Logo = brand.icon ?? LayoutGrid;
  const entries = Object.entries(views);

  const close = (): void => setMenuOpen(false);
  const choose = (id: string): void => {
    selectView(id);
    close();
  };

  return (
    <header className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2">
      <div className="flex shrink-0 items-center gap-2">
        <Logo className="h-6 w-6 text-accent" />
        <span className="text-xl font-bold text-ink">{brand.name}</span>
      </div>

      <div className="hidden w-full items-center gap-2 md:flex">
        <div aria-hidden="true" className="h-6 border-l border-line" />
        <ActionGroup actions={actions} size="label" />
        <div aria-hidden="true" className="h-6 border-l border-line" />
        <ViewTabs entries={entries} active={view} onSelect={selectView} />
        <div className="flex-1" />
        <div aria-hidden="true" className="h-6 border-l border-line" />
        <button
          type="button"
          className={ICON_BUTTON}
          onClick={() => togglePanel("right")}
          aria-pressed={panels.right}
          title="Toggle right panel"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
        {hasAssistant ? (
          <button
            type="button"
            className={ICON_BUTTON}
            onClick={() => togglePanel("assistant")}
            aria-pressed={panels.assistant}
            title="Toggle assistant panel"
          >
            <Sparkles className="h-4 w-4" />
          </button>
        ) : null}
        <div aria-hidden="true" className="h-6 border-l border-line" />
        <button
          type="button"
          className={ICON_BUTTON}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        {brand.initials ? <Avatar initials={brand.initials} /> : null}
      </div>

      <div className="flex w-full items-center gap-2 md:hidden">
        <div aria-hidden="true" className="h-6 border-l border-line" />
        <ViewTabs entries={entries} active={view} onSelect={selectView} />
        <div className="flex-1" />
        <div className="relative">
          <button
            type="button"
            className={ICON_BUTTON}
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            title="Menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <MobileMenu
              actions={actions}
              entries={entries}
              active={view}
              hasAssistant={hasAssistant}
              panels={panels}
              theme={theme}
              onChooseView={choose}
              onTogglePanel={togglePanel}
              onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
              onClose={close}
            />
          ) : null}
        </div>
        {brand.initials ? <Avatar initials={brand.initials} /> : null}
      </div>
    </header>
  );
}

function Avatar({ initials }: { initials: string }): ReactElement {
  return (
    <div
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink"
    >
      {initials}
    </div>
  );
}

function ViewTabs({
  entries,
  active,
  onSelect,
}: {
  entries: [string, ViewSpec][];
  active: string;
  onSelect: (id: string) => void;
}): ReactElement {
  return (
    <div role="tablist" className="flex items-center gap-1">
      {entries.map(([id, spec], index) => {
        const Icon = spec.icon;
        const isActive = id === active;
        const edge =
          index === 0 ? "rounded-l-md" : index === entries.length - 1 ? "rounded-r-md" : "";
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            title={spec.longLabel ?? spec.label}
            onClick={() => onSelect(id)}
            className={`inline-flex h-8 items-center justify-center gap-1 border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${edge} ${
              index > 0 ? "-ml-px" : ""
            } ${
              isActive
                ? "border-accent bg-accent text-accent-ink hover:bg-accent-hover"
                : "border-line bg-surface-raised text-ink-muted hover:bg-surface-sunken hover:text-ink"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden lg:inline">{spec.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const MENU_ITEM =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-sunken";

function MobileMenu({
  actions,
  entries,
  active,
  hasAssistant,
  panels,
  theme,
  onChooseView,
  onTogglePanel,
  onToggleTheme,
  onClose,
}: {
  actions: ShellAction[];
  entries: [string, ViewSpec][];
  active: string;
  hasAssistant: boolean;
  panels: { right: boolean; assistant: boolean };
  theme: "light" | "dark";
  onChooseView: (id: string) => void;
  onTogglePanel: (panel: "right" | "assistant") => void;
  onToggleTheme: () => void;
  onClose: () => void;
}): ReactElement {
  const row = (label: string, node: ReactElement): ReactElement => (
    <>
      <div className="px-3 py-1 text-xs uppercase tracking-wide text-ink-faint">{label}</div>
      {node}
    </>
  );

  return (
    <div
      role="menu"
      className="absolute top-11 right-0 z-50 w-56 overflow-hidden rounded-md border border-line bg-surface text-ink shadow-lg"
    >
      {row(
        "Views",
        <>
          {entries.map(([id, spec]) => {
            const Icon = spec.icon;
            return (
              <button
                key={id}
                type="button"
                role="menuitemradio"
                aria-checked={id === active}
                onClick={() => onChooseView(id)}
                className={`${MENU_ITEM} ${id === active ? "text-accent" : ""}`}
              >
                <Icon className="h-4 w-4" />
                {spec.longLabel ?? spec.label}
              </button>
            );
          })}
        </>,
      )}
      {actions.length > 0
        ? row(
            "Actions",
            <>
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onClose();
                      action.onSelect?.();
                    }}
                    className={MENU_ITEM}
                  >
                    <Icon className="h-4 w-4" />
                    {action.label}
                  </button>
                );
              })}
            </>,
          )
        : null}
      {row(
        "Panels",
        <>
          <button
            type="button"
            role="menuitem"
            onClick={() => onTogglePanel("right")}
            className={MENU_ITEM}
          >
            <PanelRightClose className="h-4 w-4" />
            Right panel
            <PanelState open={panels.right} />
          </button>
          {hasAssistant ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => onTogglePanel("assistant")}
              className={MENU_ITEM}
            >
              <Sparkles className="h-4 w-4" />
              Assistant
              <PanelState open={panels.assistant} />
            </button>
          ) : null}
          <button type="button" role="menuitem" onClick={onToggleTheme} className={MENU_ITEM}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Light theme" : "Dark theme"}
          </button>
        </>,
      )}
      <div className="flex items-center gap-2 border-t border-line px-3 py-2 text-xs text-ink-faint">
        <Settings className="h-3 w-3" />
        {entries.length} views
      </div>
    </div>
  );
}

function PanelState({ open }: { open: boolean }): ReactElement {
  return <span className="ml-auto text-xs text-ink-faint">{open ? "shown" : "hidden"}</span>;
}
