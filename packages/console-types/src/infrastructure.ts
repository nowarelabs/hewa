/**
 * The `infrastructure` view: the physical and virtual nodes traffic moves
 * through.
 *
 * A bandwidth marketplace sells somebody else's capacity, so the thing the
 * console has to answer first is not how much bandwidth is for sale but whether
 * the thing it would be sold over is there. That is what this view holds.
 */

/**
 * What kind of thing a node is.
 *
 * A vocabulary rather than a set of whatever the rows happen to contain, so a
 * kind with nothing in it this week still gets a chip — a filter that appears
 * and disappears as the data moves is a control that is only sometimes there.
 */
export type NodeKind =
  | "data_center"
  | "metro_fiber"
  | "long_haul_fiber"
  | "ixp"
  | "subsea_cable"
  | "cdn_edge";

/**
 * Every {@link NodeKind}, in the order an operator reads them.
 *
 * A runtime list beside the union rather than a list in the app, and typed
 * `readonly NodeKind[]` so a kind added to the union without a place in this
 * order is a compile error rather than a kind that sorts to the bottom of a rail
 * because nobody remembered it. The service sends the same values in `meta.groups`,
 * so a rail built from this and a chip bar built from that are reading one
 * vocabulary.
 */
export const NODE_KINDS: readonly NodeKind[] = [
  "data_center",
  "metro_fiber",
  "long_haul_fiber",
  "ixp",
  "subsea_cable",
  "cdn_edge",
];

/** Whether a node is carrying traffic as promised. */
export type NodeStatus = "operational" | "degraded" | "maintenance" | "offline";

/** Every {@link NodeStatus}, worst last-read first. */
export const NODE_STATUSES: readonly NodeStatus[] = [
  "operational",
  "degraded",
  "maintenance",
  "offline",
];

/** How each kind is written in a rail label or a column heading. */
export const NODE_KIND_TITLES: Readonly<Record<NodeKind, string>> = {
  data_center: "Data centre",
  metro_fiber: "Metro fibre",
  long_haul_fiber: "Long haul fibre",
  ixp: "IXP",
  subsea_cable: "Subsea cable",
  cdn_edge: "CDN edge",
};

/**
 * A point on the network, and its health.
 *
 * Utilisation is a measurement and availability is a commitment, so it is an
 * integer in basis points rather than a fraction of 1 — see `SlaCommitment` in
 * `@hewa/marketplace-types` for why a float cannot decide that boundary.
 */
export interface InfrastructureNode {
  readonly id: string;
  readonly name: string;
  readonly kind: NodeKind;
  readonly provider: string;
  readonly city: string;
  readonly country: string;
  readonly lat: number;
  readonly lng: number;
  /** Installed capacity in whole gigabits per second. */
  readonly capacityGbps: number;
  /** Utilisation in basis points, 0 to 10_000. 9875 is 98.75%. */
  readonly utilisationBps: number;
  readonly status: NodeStatus;
  /** An ISO 8601 instant. The service sends the string; the panel formats it. */
  readonly observedAt: string;
}
