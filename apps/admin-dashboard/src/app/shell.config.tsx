"use client";

import {
  AlertTriangle,
  ArrowRightLeft,
  Bell,
  Filter,
  RefreshCw,
  Server,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import {
  ALERT_SEVERITIES,
  ALERT_SEVERITY_TITLES,
  MARKET_POOL_TITLES,
  NODE_KINDS,
  NODE_KIND_TITLES,
  SETTLEMENT_KINDS,
  SETTLEMENT_KIND_TITLES,
  type MarketPool,
  type NodeKind,
  type SettlementKind,
} from "@hewa/console-types";
import { SLA_STATES, SLA_STATE_TITLES } from "@hewa/marketplace-types";

import type { ComponentType, ReactNode } from "react";
import type { PanelProps, RailItem, ShellConfig, ShellIcon, ViewSpec } from "@hewa/app-shell";

import { AlertDetailsPanel, AlertRailPanel, AlertsFeed } from "./panels/alerts";
import {
  InfrastructureDetailsPanel,
  InfrastructureList,
  InfrastructureRailPanel,
} from "./panels/infrastructure";
import { MarketDetailsPanel, MarketRailPanel, MarketTable } from "./panels/market";
import { SettlementDetailsPanel, SettlementFeed, SettlementRailPanel } from "./panels/settlement";
import { SlaDetailsPanel, SlaMonitorList, SlaRailPanel } from "./panels/slas";
import { Assistant, type AssistantWidget } from "./ui/primitives";

/**
 * The app.
 *
 * Everything below is data: which views exist, what each one is called, which
 * panels it opens, which analyses its assistant column offers, and what its status
 * line says. The shell turns this into the title bar, the tab strip, the rail,
 * three columns and a status bar, so there is no component here to keep in step
 * with them.
 */

/**
 * The status-line buttons that have no behaviour behind them.
 *
 * Inventing one would be worse than saying so, so `noop` is named for what it is.
 */
const noop = (): void => {};

/**
 * A rail built from a view's own group vocabulary.
 *
 * The ids are the group values, not slugs, so a rail selection joins against the
 * row's field with no lookup table to fall out of step — which is what the
 * hand-written rails did, and which is why a tab once opened an empty column.
 * The first entry is the one that means every group and is spelled `all`, which
 * cannot be mistaken for a kind, a severity or a state.
 *
 * Every group gets a tab, including a group nothing is on this week. A tab that
 * appears and disappears with the data is a control that is only sometimes there,
 * and the same argument the summary bar's chips are built on.
 */
function groupRail<TGroup extends string>(options: {
  icon: ShellIcon;
  allLabel: string;
  groups: readonly TGroup[];
  title: (group: TGroup) => string;
  render: ComponentType<PanelProps>;
}): RailItem[] {
  const { icon, allLabel, groups, title, render } = options;

  return [
    { id: "all", label: allLabel, icon, panel: { title: allLabel, render } },
    ...groups.map((group) => ({
      id: group,
      label: title(group),
      icon,
      panel: { title: title(group), render },
    })),
  ];
}

/** A rail over the four trading pools, which is what the market document splits by. */
function marketRail(): RailItem[] {
  const pools = Object.entries(MARKET_POOL_TITLES) as [MarketPool, string][];

  return pools.map(([pool, label]) => ({
    id: pool,
    label,
    icon: TrendingUp,
    panel: { title: label, render: MarketRailPanel },
  }));
}

function assistant(task: string, widgets: readonly AssistantWidget[]): ReactNode {
  return <Assistant task={task} widgets={widgets} />;
}

const views: Record<string, ViewSpec> = {
  market: {
    label: "Market",
    longLabel: "Bandwidth market",
    icon: TrendingUp,
    // The market is a document rather than a list, so its rail picks a pool — the
    // one thing a pool rail can select that a filter chip cannot.
    rail: marketRail(),
    main: { render: MarketTable },
    right: { title: "Pool details", render: MarketDetailsPanel },
    assistant: {
      title: "Assistant",
      render: () =>
        assistant("Read the book and say where capacity is about to get expensive.", [
          {
            id: "dynamic-pricing",
            name: "Dynamic pricing",
            summary:
              "Recommend a unit price per pool from the resting book and the recent spot prices.",
          },
          {
            id: "counterparty-exposure",
            name: "Counterparty exposure",
            summary:
              "Committed capacity per provider, ranked, so one supplier's failure is a figure rather than a surprise.",
          },
        ]),
    },
    status: {
      message: "Bandwidth order book",
      actions: [{ id: "refresh", label: "Refresh", icon: RefreshCw, onSelect: noop }],
    },
  },

  infrastructure: {
    label: "Network",
    longLabel: "Infrastructure",
    icon: Server,
    rail: groupRail<NodeKind>({
      icon: Server,
      allLabel: "All nodes",
      groups: NODE_KINDS,
      title: (kind) => NODE_KIND_TITLES[kind],
      render: InfrastructureRailPanel,
    }),
    main: { render: InfrastructureList },
    right: { title: "Node details", render: InfrastructureDetailsPanel },
    assistant: {
      title: "Assistant",
      render: () =>
        assistant("Say where traffic should move next, and what would break if it did.", [
          {
            id: "rerouting",
            name: "Rerouting",
            summary:
              "Alternate paths for the busiest corridors, from utilisation and the nodes that could carry them.",
          },
          {
            id: "capacity-forecast",
            name: "Capacity forecast",
            summary:
              "Where utilisation crosses a threshold next, per node, from the observed figure.",
          },
        ]),
    },
    status: {
      message: "Nodes and their headroom",
      actions: [
        { id: "filter", label: "Filter", icon: Filter, onSelect: noop },
        { id: "refresh", label: "Refresh", icon: RefreshCw, onSelect: noop },
      ],
    },
  },

  settlement: {
    label: "Money",
    longLabel: "Settlement",
    icon: ArrowRightLeft,
    rail: groupRail<SettlementKind>({
      icon: ArrowRightLeft,
      allLabel: "All movements",
      groups: SETTLEMENT_KINDS,
      title: (kind) => SETTLEMENT_KIND_TITLES[kind],
      render: SettlementRailPanel,
    }),
    main: { render: SettlementFeed },
    right: { title: "Movement details", render: SettlementDetailsPanel },
    assistant: {
      title: "Assistant",
      render: () =>
        assistant("Reconcile a run before it is signed off.", [
          {
            id: "run-reconciliation",
            name: "Run reconciliation",
            summary:
              "Check a batch's movements against the ledger and name the lines that do not agree, before a credit is issued.",
          },
          {
            id: "fee-anomaly",
            name: "Fee anomaly",
            summary: "Movements whose fee differs from the rate their kind should carry.",
          },
        ]),
    },
    status: {
      message: "Value movement",
      actions: [
        { id: "filter", label: "Filter", icon: Filter, onSelect: noop },
        { id: "refresh", label: "Refresh", icon: RefreshCw, onSelect: noop },
      ],
    },
  },

  slas: {
    label: "SLAs",
    longLabel: "Service levels",
    icon: ShieldCheck,
    rail: groupRail({
      icon: ShieldCheck,
      allLabel: "All commitments",
      groups: SLA_STATES,
      title: (state) => SLA_STATE_TITLES[state],
      render: SlaRailPanel,
    }),
    main: { render: SlaMonitorList },
    right: { title: "Commitment details", render: SlaDetailsPanel },
    assistant: {
      title: "Assistant",
      render: () =>
        assistant("Say which commitments are heading for a breach, and what it will cost.", [
          {
            id: "sla-prediction",
            name: "SLA prediction",
            summary:
              "Project each commitment's availability forward from its measurements and name the ones crossing the target.",
          },
          {
            id: "credit-preview",
            name: "Credit preview",
            summary:
              "The credit each projected shortfall would produce, in minor units, from the commitment's own rate.",
          },
        ]),
    },
    status: {
      message: "Monitored commitments",
      actions: [
        { id: "filter", label: "Filter", icon: Filter, onSelect: noop },
        { id: "refresh", label: "Refresh", icon: RefreshCw, onSelect: noop },
      ],
    },
  },

  alerts: {
    label: "Alerts",
    longLabel: "Alerts",
    icon: AlertTriangle,
    rail: groupRail({
      icon: AlertTriangle,
      allLabel: "All alerts",
      groups: ALERT_SEVERITIES,
      title: (severity) => ALERT_SEVERITY_TITLES[severity],
      render: AlertRailPanel,
    }),
    main: { render: AlertsFeed },
    right: { title: "Alert details", render: AlertDetailsPanel },
    assistant: {
      title: "Assistant",
      render: () =>
        assistant("Say which alerts are one problem seen twice.", [
          {
            id: "anomaly-correlation",
            name: "Anomaly correlation",
            summary:
              "Group alerts that share an entity, a provider or a corridor, so one outage is not four pages.",
          },
          {
            id: "impact-summary",
            name: "Impact summary",
            summary: "Impacted capacity and the commitments riding on it, per correlated group.",
          },
        ]),
    },
    status: {
      message: "Things needing attention",
      actions: [
        { id: "filter", label: "Filter", icon: Filter, onSelect: noop },
        { id: "acknowledge", label: "Acknowledge", icon: Bell, onSelect: noop },
      ],
    },
  },
};

export const config: ShellConfig = {
  brand: { name: "Hewa", initials: "HW" },
  defaultView: "market",
  views,
  syncUrl: true,
};
