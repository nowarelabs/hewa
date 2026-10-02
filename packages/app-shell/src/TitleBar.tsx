import { useState } from "react";
import type { ReactElement } from "react";
import {
  LayoutGrid,
  Menu,
  Moon,
  PanelLeftClose,
  PanelRightClose,
  Settings,
  Sparkles,
  Sun,
} from "lucide-react";

import { ActionGroup } from "./ActionGroup";
import { useShellState } from "./state";
import { ViewTabs } from "./ViewTabs";
import type { PanelSide } from "./layout";
import type { BrandSpec, PanelRole, PanelSpec, ShellAction, ViewSpec } from "./types";

const ICON_BUTTON =
  "inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface-raised text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40";

/**
 * What a role is called in the title bar's own words.
 *
 * `null` is the right-hand pair, which are not the left column and are not named
 * by role either: a details panel and an assistant are not a filter and a search,
 * and calling them "info" would be the shell guessing at contents it cannot see.
 */
const ROLE_NOUNS: Partial<Record<PanelRole, string>> = {
  filter: "filters",
  search: "search",
  info: "details",
  edit: "edit",
  ops: "operations",
};

/**
 * The name of a panel's toggle, from its role if it declared one.
 *
 * "Toggle filters" rather than "Toggle left panel". A name taken from geometry
 * tells the reader where to look and not what they will find, and the slot this
 * button opens can hold a filter, a search, a legend, a form or a console — so a
 * name that fits one of them is a name that is wrong for four. The side is the
 * fallback, because a button that names nothing at all is worse than one that
 * names its own position.
 */
function panelName(spec: PanelSpec, fallback: string): string {
  const noun = spec.role === undefined ? undefined : ROLE_NOUNS[spec.role];
  return noun ?? spec.title ?? fallback;
}

/**
 * The top chrome, on every viewport.
 *
 * Identity, the app's own buttons, the panel toggles, the theme switch, and the
 * account corner — all of them in the same place at every width. The one control
 * that moves is the view tabs, and they are the same {@link ViewTabs} element that
 * sits in the status bar on a narrow screen.
 *
 * The bars divide the row rather than decide who owns it. The app's own actions and
 * the tabs are wide-only because a 320px screen has room for the answer to "where
 * am I" and none for a second row of the app's buttons; the overflow menu is
 * narrow-only because it exists for exactly what does not fit, which on a wide
 * screen is nothing.
 */
export function TitleBar({
  brand,
  actions,
  statusActions = [],
  views,
  left,
  hasAssistant,
}: {
  brand: BrandSpec;
  actions: ShellAction[];
  /**
   * The destination's status-bar actions, on a layout that is not drawing them.
   *
   * Here because a narrow screen spends the status bar on the tabs, so an action
   * that only ever existed in the cluster it replaced is a control that has
   * disappeared rather than one that moved. They go into the menu's single
   * "Actions" group beside the app's own, so there is one list and not two that
   * happen to hold the same control.
   */
  statusActions?: ShellAction[];
  views: Record<string, ViewSpec>;
  /**
   * The destination's left panel, and not a boolean.
   *
   * The spec, because the toggle is named after what the panel holds — see
   * {@link panelName} — and a boolean could only say "left".
   */
  left: PanelSpec;
  hasAssistant: boolean;
}): ReactElement {
  const { layout, view, selectView } = useShellState();
  const entries = Object.entries(views);
  const leftName = panelName(left, "left panel");
  const menuActions = byId([...actions, ...statusActions]);
  const wide = layout === "column";

  return (
    <header
      data-shell-title-bar=""
      className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2"
    >
      <Brand brand={brand} />
      {/* The app's own actions and the tabs are the two things a narrow screen has
          no room for, so they leave rather than crowding out the toggles.

          `wide` is the shell's measurement and not a `md:` class, because the class
          would be a second reading of the same width: the tabs are in the status
          bar on that layout, and two answers to "which bar is this in" is a bar
          that is briefly in both. It costs one frame on a phone's first paint,
          which is the same cost the panels already pay — the server claims the
          column layout and the correction lands before the first paint. */}
      {wide ? (
        <>
          <Divider />
          <ActionGroup actions={actions} size="label" />
          <Divider />
          <ViewTabs entries={entries} active={view} onSelect={selectView} />
        </>
      ) : null}
      <div className="flex-1" />
      <PanelToggles leftName={leftName} hasAssistant={hasAssistant} />
      {!wide ? (
        <MenuButton
          actions={menuActions}
          entries={entries}
          active={view}
          leftName={leftName}
          hasAssistant={hasAssistant}
          onChooseView={selectView}
        />
      ) : null}
      <ThemeButton />
      <Avatar brand={brand} />
    </header>
  );
}

function Divider(): ReactElement {
  return <div aria-hidden="true" className="h-6 border-l border-line" />;
}

/**
 * Actions by id, first one wins.
 *
 * The app's actions and the status bar's are two lists an app filled in
 * separately, and a duplicate `id` between them is a React key collision and a menu
 * with the same control in it twice. Keeping the app's own is the arbitrary choice;
 * what is not arbitrary is having it written down.
 */
function byId(actions: ShellAction[]): ShellAction[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    if (seen.has(action.id)) return false;
    seen.add(action.id);
    return true;
  });
}

/**
 * Identity.
 *
 * The name truncates, because the brand is the one thing here that is allowed to
 * lose: a console's name is legible from the first three letters, and the controls
 * are not allowed to. The tabs scroll for the same reason, in the bar that carries
 * them.
 */
function Brand({ brand }: { brand: BrandSpec }): ReactElement {
  const Logo = brand.icon ?? LayoutGrid;
  return (
    <div className="flex min-w-0 shrink-0 items-center gap-2">
      <Logo className="h-6 w-6 shrink-0 text-accent" />
      <span className="truncate text-xl font-bold text-ink">{brand.name}</span>
    </div>
  );
}

/**
 * One panel's toggle.
 *
 * A button rather than a menu row because a narrow screen still needs it in the bar
 * itself, and `aria-pressed` because it is a toggle: the reader has to be able to
 * tell a panel that is open from one that is closed without opening it to find out.
 */
function PanelToggles({
  leftName,
  hasAssistant,
}: {
  leftName: string;
  hasAssistant: boolean;
}): ReactElement {
  const { layout, panels, togglePanel } = useShellState();
  // "Show filters" over an overlay, "Toggle filters" beside a column: the same
  // button, and the wording that says which one the press will do.
  const verb = layout === "sheet" ? "Show" : "Toggle";
  const rightName = "right panel";
  const assistantName = "assistant";

  return (
    <>
      <PanelToggle
        icon={<PanelLeftClose className="h-4 w-4" />}
        label={`${verb} ${leftName}`}
        open={panels.left}
        onToggle={() => togglePanel("left")}
      />
      <PanelToggle
        icon={<PanelRightClose className="h-4 w-4" />}
        label={`${verb} ${rightName}`}
        open={panels.right}
        onToggle={() => togglePanel("right")}
      />
      {hasAssistant ? (
        <PanelToggle
          icon={<Sparkles className="h-4 w-4" />}
          label={`${verb} ${assistantName}`}
          open={panels.assistant}
          onToggle={() => togglePanel("assistant")}
        />
      ) : null}
    </>
  );
}

function PanelToggle({
  icon,
  label,
  open,
  onToggle,
}: {
  icon: ReactElement;
  label: string;
  open: boolean;
  onToggle: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      className={ICON_BUTTON}
      onClick={onToggle}
      aria-pressed={open}
      title={label}
    >
      {icon}
    </button>
  );
}

/**
 * The theme switch.
 *
 * In the bar at every width, and also in the menu below it. A control that is
 * reachable in two places is fine when one of them is the one under the reader's
 * thumb, and the bar is where it was before the tabs moved.
 */
function ThemeButton(): ReactElement {
  const { theme, setTheme } = useShellState();
  return (
    <button
      type="button"
      className={ICON_BUTTON}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      title="Toggle theme"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

/**
 * The overflow menu: what a narrow screen could not fit in the bar.
 *
 * It hangs off the top bar and opens downwards, which is where a menu can go when
 * the button is in the bar at the top of the screen.
 */
function MenuButton({
  actions,
  entries,
  active,
  leftName,
  hasAssistant,
  onChooseView,
}: {
  actions: ShellAction[];
  entries: [string, ViewSpec][];
  active: string;
  leftName: string;
  hasAssistant: boolean;
  onChooseView: (id: string) => void;
}): ReactElement {
  const { panels, togglePanel, theme, setTheme } = useShellState();
  const [open, setOpen] = useState(false);
  const close = (): void => setOpen(false);

  return (
    <div className="relative">
      <button
        type="button"
        className={ICON_BUTTON}
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Menu"
      >
        <Menu className="h-4 w-4" />
      </button>
      {open ? (
        <MobileMenu
          actions={actions}
          entries={entries}
          active={active}
          left={leftName}
          hasAssistant={hasAssistant}
          panels={panels}
          theme={theme}
          onChooseView={(id) => {
            onChooseView(id);
            close();
          }}
          onTogglePanel={togglePanel}
          onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

function Avatar({ brand }: { brand: BrandSpec }): ReactElement {
  if (brand.initials === undefined) {
    return <></>;
  }
  return (
    <div
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink"
    >
      {brand.initials}
    </div>
  );
}

const MENU_ITEM =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-sunken";

function MobileMenu({
  actions,
  entries,
  active,
  left,
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
  /** The left panel's name. */
  left: string;
  hasAssistant: boolean;
  panels: Record<PanelSide, boolean>;
  theme: "light" | "dark";
  onChooseView: (id: string) => void;
  onTogglePanel: (panel: PanelSide) => void;
  onToggleTheme: () => void;
  onClose: () => void;
}): ReactElement {
  const row = (label: string, node: ReactElement): ReactElement => (
    <>
      <div className="px-3 py-1 text-xs uppercase tracking-wide text-ink-faint">{label}</div>
      {node}
    </>
  );
  const rightName = "right panel";
  const assistantName = "assistant";

  return (
    <div
      role="menu"
      className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-md border border-line bg-surface text-ink shadow-lg"
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
            aria-pressed={panels.left}
            onClick={() => onTogglePanel("left")}
            className={MENU_ITEM}
          >
            <PanelLeftClose className="h-4 w-4" />
            {left}
            <PanelState open={panels.left} />
          </button>
          <button
            type="button"
            role="menuitem"
            aria-pressed={panels.right}
            onClick={() => onTogglePanel("right")}
            className={MENU_ITEM}
          >
            <PanelRightClose className="h-4 w-4" />
            {rightName}
            <PanelState open={panels.right} />
          </button>
          {hasAssistant ? (
            <button
              type="button"
              role="menuitem"
              aria-pressed={panels.assistant}
              onClick={() => onTogglePanel("assistant")}
              className={MENU_ITEM}
            >
              <Sparkles className="h-4 w-4" />
              {assistantName}
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
