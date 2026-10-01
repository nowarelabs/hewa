import type {
  Alert,
  AlertSeverity,
  CapacityPressure,
  OutageGroup,
  SecurityEvent,
} from "./alerts.js";
import { CONSOLE_VIEWS, type ConsoleEnvelope, type ConsoleViewKey } from "./envelope.js";
import type {
  InfrastructureNode,
  NodeHeadroom,
  NodeKind,
  ProviderFootprint,
} from "./infrastructure.js";
import type { MarketBook, PriceHistory, VenueBreakdown } from "./market.js";
import type { Payout, Settlement, SettlementKind, SettlementRun } from "./settlement.js";
import type { SlaCredit, SlaMonitor, SlaRisk, SlaState } from "./slas.js";
import type { TransactionStatus } from "@hewa/marketplace-types";

/**
 * The console's sections: which ones exist, what each is called, and what each
 * answers with.
 *
 * The envelope every one of them travels in is declared in `envelope.ts`; this file
 * is the navigation.
 *
 * ## A rail button is a destination, not a filter
 *
 * The rails used to be built out of each view's group vocabulary — `ixp`,
 * `subsea_cable`, `breached` — which is a second way of doing what the summary
 * bar's chips already do, over the same rows, from the same single endpoint. It
 * looks like navigation and behaves like a filter, and an operator reading a rail
 * of node kinds reasonably concludes "subsea cable" is a *place* rather than a
 * *predicate*, then finds it is also a chip in the other column.
 *
 * So every section below is a question with its own answer: its own endpoint, its
 * own rows, its own main column and its own right column. `market/book` and
 * `market/prices` read the same two tables and answer different questions about
 * them, which is the test — if two sections can be answered by the same rows with
 * the same columns, they are one section and the rail is lying.
 */
export const CONSOLE_SECTIONS = {
  market: ["book", "prices", "venues"] as const,
  infrastructure: ["nodes", "headroom", "providers"] as const,
  settlement: ["movements", "runs", "payouts"] as const,
  slas: ["commitments", "at_risk", "credits"] as const,
  alerts: ["feed", "outages", "capacity", "security"] as const,
} as const;

export type ConsoleSectionId<V extends ConsoleViewKey> = (typeof CONSOLE_SECTIONS)[V][number];

export type ConsoleSectionKey = {
  [V in ConsoleViewKey]: `${V}/${ConsoleSectionId<V>}`;
}[ConsoleViewKey];

export const CONSOLE_SECTION_KEYS: readonly ConsoleSectionKey[] = CONSOLE_VIEWS.flatMap((view) =>
  CONSOLE_SECTIONS[view].map((section) => `${view}/${section}` as ConsoleSectionKey),
);

export const SECTION_TITLES: Readonly<Record<ConsoleSectionKey, string>> = {
  "market/book": "Order book",
  "market/prices": "Prices",
  "market/venues": "Venues",
  "infrastructure/nodes": "Nodes",
  "infrastructure/headroom": "Headroom",
  "infrastructure/providers": "Providers",
  "settlement/movements": "Movements",
  "settlement/runs": "Runs",
  "settlement/payouts": "Payouts",
  "slas/commitments": "Commitments",
  "slas/at_risk": "At risk",
  "slas/credits": "Credits",
  "alerts/feed": "Feed",
  "alerts/outages": "Outages",
  "alerts/capacity": "Capacity",
  "alerts/security": "Security",
};

export function consoleSectionPath<V extends ConsoleViewKey>(
  view: V,
  section: ConsoleSectionId<V>,
): string {
  return `/api/v1/${view}/${section}`;
}

export function parseSectionKey(key: ConsoleSectionKey): {
  view: ConsoleViewKey;
  section: string;
} {
  const [view, section] = key.split("/");
  return { view: view as ConsoleViewKey, section: section ?? "" };
}

/**
 * The payload map: what each section's endpoint answers with.
 */
export interface ConsolePayload {
  // market
  "market/book": ConsoleEnvelope<MarketBook, never>;
  "market/prices": ConsoleEnvelope<PriceHistory, never>;
  "market/venues": ConsoleEnvelope<VenueBreakdown, never>;

  // infrastructure
  "infrastructure/nodes": ConsoleEnvelope<InfrastructureNode[], NodeKind>;
  "infrastructure/headroom": ConsoleEnvelope<NodeHeadroom[], NodeKind>;
  "infrastructure/providers": ConsoleEnvelope<ProviderFootprint[], never>;

  // settlement
  "settlement/movements": ConsoleEnvelope<Settlement[], SettlementKind>;
  "settlement/runs": ConsoleEnvelope<SettlementRun[], never>;
  "settlement/payouts": ConsoleEnvelope<Payout[], TransactionStatus>;

  // slas
  "slas/commitments": ConsoleEnvelope<SlaMonitor[], SlaState>;
  "slas/at_risk": ConsoleEnvelope<SlaRisk[], SlaState>;
  "slas/credits": ConsoleEnvelope<SlaCredit[], SlaState>;

  // alerts
  "alerts/feed": ConsoleEnvelope<Alert[], AlertSeverity>;
  "alerts/outages": ConsoleEnvelope<OutageGroup[], AlertSeverity>;
  "alerts/capacity": ConsoleEnvelope<CapacityPressure[], AlertSeverity>;
  "alerts/security": ConsoleEnvelope<SecurityEvent[], AlertSeverity>;
}

export type ConsoleData<K extends ConsoleSectionKey> = ConsolePayload[K]["data"];
export type ConsoleGroups<K extends ConsoleSectionKey> = ConsolePayload[K]["meta"]["groups"];
