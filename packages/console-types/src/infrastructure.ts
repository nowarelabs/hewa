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

/**
 * `infrastructure/headroom`: how much room each node has left.
 *
 * The question is "where can the next order go", and it cannot be answered from
 * `capacityGbps` and `utilisationBps` without arithmetic done in the panel — which
 * is arithmetic that has to happen, because capacity * utilisation is not one of
 * the two columns and a browser that computes it differently from the service is
 * a browser reporting a node full when the service reports it half empty.
 *
 * Both figures are whole gigabits per second, because capacity is traded in whole
 * gigabits and a headroom of 0.4 Gbps is a number nobody can sell.
 */
export interface NodeHeadroom {
  readonly nodeId: string;
  readonly name: string;
  readonly kind: NodeKind;
  readonly provider: string;
  readonly city: string;
  readonly country: string;
  readonly capacityGbps: number;
  /** Capacity already in use, in whole gigabits per second. */
  readonly committedGbps: number;
  /** Capacity still available. `capacityGbps - committedGbps`, floored at 0. */
  readonly headroomGbps: number;
  /** Utilisation in basis points, carried so a bar can be drawn without recomputing. */
  readonly utilisationBps: number;
  readonly status: NodeStatus;
  /** An ISO 8601 instant. */
  readonly observedAt: string;
}

/**
 * `infrastructure/providers`: who supplies the network.
 *
 * The concentration view. One provider holding every subsea cable is the single
 * fact that decides how much a corridor outage costs, and it is invisible in a
 * table of nodes — it is only visible once the nodes are rolled up by who runs
 * them.
 *
 * `utilisationBps` is capacity-weighted rather than the mean of the nodes', because
 * a provider running one 10 Gbps node at 10% and one 1,000 Gbps node at 90% is a
 * provider at 89%, and averaging the two says 50%.
 */
export interface ProviderFootprint {
  readonly provider: string;
  readonly nodeCount: number;
  /** The kinds this provider runs, in vocabulary order. */
  readonly kinds: NodeKind[];
  /** Distinct countries, sorted, so two rows cannot disagree about where they are. */
  readonly countries: string[];
  readonly capacityGbps: number;
  readonly committedGbps: number;
  readonly utilisationBps: number;
  /** How many of this provider's nodes are not `operational`. */
  readonly impaired: number;
}
