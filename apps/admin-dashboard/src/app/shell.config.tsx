"use client";

import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  Bell,
  BookOpen,
  Coins,
  FileCheck2,
  Filter,
  Gauge,
  HardDrive,
  Layers,
  LineChart,
  PieChart,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { ShellAction, ShellConfig, StatusSpec, ViewSpec } from "@hewa/app-shell";

import {
  AtRiskDetails,
  AtRiskPanel,
  CommitmentsDetails,
  CommitmentsPanel,
  CreditsDetails,
  CreditsPanel,
} from "./panels/slas";
import {
  CapacityDetails,
  CapacityPanel,
  FeedDetails,
  FeedPanel,
  OutagesDetails,
  OutagesPanel,
  SecurityDetails,
  SecurityPanel,
} from "./panels/alerts";
import {
  HeadroomDetails,
  HeadroomPanel,
  NodesDetails,
  NodesPanel,
  ProvidersDetails,
  ProvidersPanel,
} from "./panels/infrastructure";
import {
  BookDetails,
  BookPanel,
  PricesDetails,
  PricesPanel,
  VenuesDetails,
  VenuesPanel,
} from "./panels/market";
import {
  MovementsDetails,
  MovementsPanel,
  PayoutsDetails,
  PayoutsPanel,
  RunsDetails,
  RunsPanel,
} from "./panels/settlement";
import { Assistant, type AssistantWidget } from "./ui/primitives";

/**
 * The app.
 *
 * Everything below is data: which views exist, which section each rail button goes
 * to, what that section's two columns are, which analyses the assistant column
 * offers, and what the status bar says. The shell turns that into the title bar,
 * the tab strip, the rail, three columns and a status bar, so there is no component
 * here to keep in step with them.
 *
 * Every rail item carries its own `section`, and its `id` is the section's last
 * half. The two are the same string, and that is deliberate rather than lazy: the
 * console's sixteen section keys are unique across the five views, so `id` and
 * `section` can agree without a lookup table. Were they ever to diverge — two views
 * with a `nodes` section each — `id` would still be unique within its own view and
 * the panels would keep fetching by `section`.
 *
 * The sixteen rail items are written out rather than generated from
 * `CONSOLE_SECTIONS`, because the registry names the endpoints and knows nothing
 * about panels. A section is a *place*: each entry below names the two columns that
 * answer its question, and the thing that makes one legible — that "at risk"
 * carries a projection column and "commitments" does not — is not expressible as an
 * argument to a helper that only knows the section key.
 */

/**
 * The status-line buttons that have no behaviour behind them.
 *
 * Inventing one would be worse than saying so, so `noop` is named for what it is.
 */
const noop = (): void => {};

const refresh: ShellAction = { id: "refresh", label: "Refresh", icon: RefreshCw, onSelect: noop };
const filter: ShellAction = { id: "filter", label: "Filter", icon: Filter, onSelect: noop };

/** A status line, given its message and its buttons. */
function statusLine(message: string, actions: readonly ShellAction[]): StatusSpec {
  return { message, actions: [...actions] };
}

function assistant(task: string, widgets: readonly AssistantWidget[]): ReactNode {
  return <Assistant task={task} widgets={widgets} />;
}

const views: Record<string, ViewSpec> = {
  market: {
    label: "Market",
    longLabel: "Bandwidth market",
    icon: TrendingUp,
    rail: [
      {
        id: "book",
        label: "Order book",
        section: "market/book",
        icon: BookOpen,
        main: { render: BookPanel },
        right: { title: "Pool", render: BookDetails },
      },
      {
        id: "prices",
        label: "Prices",
        section: "market/prices",
        icon: LineChart,
        main: { render: PricesPanel },
        right: { title: "History", render: PricesDetails },
      },
      {
        id: "venues",
        label: "Venues",
        section: "market/venues",
        icon: PieChart,
        main: { render: VenuesPanel },
        right: { title: "Share", render: VenuesDetails },
      },
    ],
    fallback: {
      main: { render: BookPanel },
      right: { title: "Pool", render: BookDetails },
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
      status: statusLine("Bandwidth order book", [refresh]),
    },
  },

  infrastructure: {
    label: "Network",
    longLabel: "Infrastructure",
    icon: Server,
    rail: [
      {
        id: "nodes",
        label: "Nodes",
        section: "infrastructure/nodes",
        icon: Server,
        main: { render: NodesPanel },
        right: { title: "Node", render: NodesDetails },
      },
      {
        id: "headroom",
        label: "Headroom",
        section: "infrastructure/headroom",
        icon: Gauge,
        main: { render: HeadroomPanel },
        right: { title: "Room left", render: HeadroomDetails },
      },
      {
        id: "providers",
        label: "Providers",
        section: "infrastructure/providers",
        icon: HardDrive,
        main: { render: ProvidersPanel },
        right: { title: "Provider footprint", render: ProvidersDetails },
      },
    ],
    fallback: {
      main: { render: NodesPanel },
      right: { title: "Node", render: NodesDetails },
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
      status: statusLine("Nodes and their headroom", [filter, refresh]),
    },
  },

  settlement: {
    label: "Money",
    longLabel: "Settlement",
    icon: ArrowRightLeft,
    rail: [
      {
        id: "movements",
        label: "Movements",
        section: "settlement/movements",
        icon: ArrowRightLeft,
        main: { render: MovementsPanel },
        right: { title: "Movement", render: MovementsDetails },
      },
      {
        id: "runs",
        label: "Runs",
        section: "settlement/runs",
        icon: Layers,
        main: { render: RunsPanel },
        right: { title: "Run", render: RunsDetails },
        status: statusLine("Batches and what they netted", [refresh]),
      },
      {
        id: "payouts",
        label: "Payouts",
        section: "settlement/payouts",
        icon: Coins,
        main: { render: PayoutsPanel },
        right: { title: "Payout", render: PayoutsDetails },
      },
    ],
    fallback: {
      main: { render: MovementsPanel },
      right: { title: "Movement", render: MovementsDetails },
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
      status: statusLine("Value movement", [filter, refresh]),
    },
  },

  slas: {
    label: "SLAs",
    longLabel: "Service levels",
    icon: ShieldCheck,
    rail: [
      {
        id: "commitments",
        label: "Commitments",
        section: "slas/commitments",
        icon: FileCheck2,
        main: { render: CommitmentsPanel },
        right: { title: "Commitment", render: CommitmentsDetails },
      },
      {
        id: "at_risk",
        label: "At risk",
        section: "slas/at_risk",
        icon: AlertTriangle,
        main: { render: AtRiskPanel },
        right: { title: "At-risk commitment", render: AtRiskDetails },
        status: statusLine("Commitments heading for a breach", [refresh]),
      },
      {
        id: "credits",
        label: "Credits",
        section: "slas/credits",
        icon: Coins,
        main: { render: CreditsPanel },
        right: { title: "Credit", render: CreditsDetails },
        status: statusLine("Credits owed, capped and paid", [refresh]),
      },
    ],
    fallback: {
      main: { render: CommitmentsPanel },
      right: { title: "Commitment", render: CommitmentsDetails },
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
      status: statusLine("Monitored commitments", [filter, refresh]),
    },
  },

  alerts: {
    label: "Alerts",
    longLabel: "Alerts",
    icon: AlertTriangle,
    rail: [
      {
        id: "feed",
        label: "Feed",
        section: "alerts/feed",
        icon: AlertTriangle,
        main: { render: FeedPanel },
        right: { title: "Alert", render: FeedDetails },
      },
      {
        id: "outages",
        label: "Outages",
        section: "alerts/outages",
        icon: TrendingDown,
        main: { render: OutagesPanel },
        right: { title: "Outage", render: OutagesDetails },
        status: statusLine("One row per thing that broke", [filter, refresh]),
      },
      {
        id: "capacity",
        label: "Capacity",
        section: "alerts/capacity",
        icon: Gauge,
        main: { render: CapacityPanel },
        right: { title: "Capacity pressure", render: CapacityDetails },
        status: statusLine("Alerts about running out of capacity", [filter, refresh]),
      },
      {
        id: "security",
        label: "Security",
        section: "alerts/security",
        icon: ShieldAlert,
        main: { render: SecurityPanel },
        right: { title: "Security event", render: SecurityDetails },
        status: statusLine("Entities that were breached", [refresh]),
      },
    ],
    fallback: {
      main: { render: FeedPanel },
      right: { title: "Alert", render: FeedDetails },
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
      status: statusLine("Things needing attention", [
        filter,
        { id: "acknowledge", label: "Acknowledge", icon: Bell, onSelect: noop },
      ]),
    },
  },
};

export const config: ShellConfig = {
  brand: { name: "Hewa", initials: "HW" },
  defaultView: "market",
  views,
  syncUrl: true,
};
