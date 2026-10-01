"use client";

import type { ReactElement } from "react";
import { Gauge, HardDrive, Server } from "lucide-react";
import {
  NODE_KIND_TITLES,
  type InfrastructureNode,
  type NodeHeadroom,
  type NodeKind,
} from "@hewa/console-types";

import { useHeadroom, useNodes, useProviders } from "../data/infrastructure";
import { useFilterParam } from "../state/filter";
import {
  Empty,
  KeyValues,
  Panel,
  SummaryBar,
  emptyMessage,
  summaryCounts,
  visibleBy,
} from "../ui/primitives";

/**
 * The `infrastructure` view's panels: two per section, and the middle column of each.
 *
 * `nodes` and `headroom` list the same nodes and are still two destinations, because
 * "where does traffic run" and "where can the next order go" are different questions
 * and only the second one needs the arithmetic. Both keep the kind chips, because both
 * answer "of what kind"; the chips narrow within the section rather than choosing it,
 * which is what the summary bar is for.
 */

function KindBar({
  rows,
  groups,
  param,
}: {
  rows: readonly { readonly kind: NodeKind }[];
  groups: readonly NodeKind[];
  param: string;
}): ReactElement {
  const filter = useFilterParam(param);

  return (
    <SummaryBar
      items={summaryCounts(rows, (row) => row.kind, {
        keys: groups,
        // The chip says "Data centre", the row says `data_center`, and the toggle is
        // on the row's value. A label the panel built by upper-casing the first
        // letter would say "Data_center", which is the wire format wearing a
        // display's clothes.
        label: (kind) => NODE_KIND_TITLES[kind],
      })}
      filter={{
        label: "Filter by kind",
        selected: filter.selected,
        onToggle: filter.toggle,
      }}
    />
  );
}

/** The empty state every list in this module shares, so none of them invents one. */
function ListEmpty({
  status,
  filtered,
  noun,
}: {
  status: "pending" | "failed" | "ready";
  filtered: boolean;
  noun: string;
}): ReactElement {
  return <Empty>{emptyMessage({ status, filtered, noun, filter: "these kinds" })}</Empty>;
}

/** `infrastructure/nodes`, middle column: every node as it stands. */
export function NodesPanel(): ReactElement {
  const { rows, groups, status } = useNodes();
  const filter = useFilterParam("infrastructure-nodes");
  const shown = visibleBy(rows, (node) => node.kind, filter.selected);

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <Server className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-ink">Nodes</h1>
        <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">
          {rows.length} nodes
        </span>
      </header>

      <KindBar rows={rows} groups={groups} param="infrastructure-nodes" />

      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
        {shown.length === 0 ? (
          <ListEmpty status={status} filtered={filter.selected.length > 0} noun="nodes" />
        ) : (
          shown.map((node) => <NodeCard key={node.id} node={node} />)
        )}
      </div>
    </div>
  );
}

function NodeCard({ node }: { node: InfrastructureNode }): ReactElement {
  return (
    <article data-row={node.id} className="rounded-lg border border-line bg-surface-raised p-4">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h2 className="font-medium text-ink">{node.name}</h2>
        <span className="shrink-0 rounded border border-line px-2 py-0.5 text-xs text-ink-muted">
          {node.status}
        </span>
      </div>
      <p className="mb-2 text-sm text-ink-muted">
        {NODE_KIND_TITLES[node.kind]} · {node.provider} · {node.city}, {node.country}
      </p>
      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-faint">
        <span className="tabular-nums">{node.capacityGbps} Gbps capacity</span>
        <span className="tabular-nums">{(node.utilisationBps / 100).toFixed(2)}% utilised</span>
        <span className="font-mono">
          {node.lat.toFixed(4)}, {node.lng.toFixed(4)}
        </span>
        <span>{new Date(node.observedAt).toLocaleString()}</span>
      </div>
    </article>
  );
}

/** `infrastructure/nodes`, right column: one node as the service holds it. */
export function NodesDetails({ section }: { section: string | null }): ReactElement {
  const { rows, status } = useNodes();
  const node = rows.find((candidate) => candidate.id === section) ?? rows[0];

  return (
    <Panel title="Node">
      {node === undefined ? (
        <Empty>
          {status !== "ready"
            ? emptyMessage({ status, filtered: false, noun: "nodes" })
            : "Select a node to view details"}
        </Empty>
      ) : (
        <KeyValues
          rows={[
            { label: "Name", value: node.name },
            { label: "Provider", value: node.provider },
            { label: "Location", value: `${node.city}, ${node.country}` },
            { label: "Kind", value: NODE_KIND_TITLES[node.kind] },
            { label: "Status", value: node.status },
            { label: "Capacity", value: `${node.capacityGbps} Gbps` },
            { label: "Utilisation", value: `${(node.utilisationBps / 100).toFixed(2)}%` },
            { label: "Observed", value: new Date(node.observedAt).toLocaleString() },
          ]}
        />
      )}
    </Panel>
  );
}

/**
 * `infrastructure/headroom`, middle column: the tightest nodes first.
 *
 * The rows arrive sorted by headroom ascending, which is the only order that answers
 * "where can the next order go" — a list of nodes sorted by name puts the full ones
 * wherever the alphabet puts them. The committed and headroom columns are read off
 * the payload rather than computed: the service derived them in the same query that
 * selected the rows, and a browser recomputing `capacity × utilisation` is a browser
 * rounding a figure that decides whether an order can be placed.
 */
export function HeadroomPanel(): ReactElement {
  const { rows, groups, status } = useHeadroom();
  const filter = useFilterParam("infrastructure-headroom");
  const shown = visibleBy(rows, (row) => row.kind, filter.selected);

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <Gauge className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-ink">Headroom</h1>
        <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">
          {rows.length} nodes
        </span>
      </header>

      <KindBar rows={rows} groups={groups} param="infrastructure-headroom" />

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {shown.length === 0 ? (
          <ListEmpty status={status} filtered={filter.selected.length > 0} noun="nodes" />
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-ink-faint">
              <tr>
                <th className="py-1 font-medium">Node</th>
                <th className="py-1 font-medium">Kind</th>
                <th className="py-1 text-right font-medium">Capacity</th>
                <th className="py-1 text-right font-medium">Committed</th>
                <th className="py-1 text-right font-medium">Headroom</th>
                <th className="py-1 text-right font-medium">Used</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((node) => (
                <tr
                  key={node.nodeId}
                  data-row={node.nodeId}
                  className="border-t border-line text-ink-muted"
                >
                  <td className="py-1">{node.name}</td>
                  <td className="py-1">{NODE_KIND_TITLES[node.kind]}</td>
                  <td className="py-1 text-right tabular-nums">{node.capacityGbps} Gbps</td>
                  <td className="py-1 text-right tabular-nums">{node.committedGbps} Gbps</td>
                  <td className="py-1 text-right tabular-nums">{node.headroomGbps} Gbps</td>
                  <td className="py-1 text-right tabular-nums">
                    {(node.utilisationBps / 100).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/** `infrastructure/headroom`, right column: one node's room, in figures. */
export function HeadroomDetails({ section }: { section: string | null }): ReactElement {
  const { rows, status } = useHeadroom();
  const node = rows.find((candidate) => candidate.nodeId === section) ?? rows[0];

  return (
    <Panel title="Room left">
      {node === undefined ? (
        <Empty>
          {status !== "ready"
            ? emptyMessage({ status, filtered: false, noun: "headroom" })
            : "Select a node to view details"}
        </Empty>
      ) : (
        <HeadroomFigures node={node} />
      )}
    </Panel>
  );
}

/** One node's room, shared by the headroom columns. */
export function HeadroomFigures({ node }: { node: NodeHeadroom }): ReactElement {
  return (
    <KeyValues
      rows={[
        { label: "Node", value: node.name },
        { label: "Provider", value: node.provider },
        { label: "Location", value: `${node.city}, ${node.country}` },
        { label: "Capacity", value: `${node.capacityGbps} Gbps` },
        { label: "Committed", value: `${node.committedGbps} Gbps` },
        { label: "Headroom", value: `${node.headroomGbps} Gbps` },
        { label: "Utilisation", value: `${(node.utilisationBps / 100).toFixed(2)}%` },
        { label: "Status", value: node.status },
      ]}
    />
  );
}

/** `infrastructure/providers`, middle column: who supplies the network. */
export function ProvidersPanel(): ReactElement {
  const { rows, status } = useProviders();

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <HardDrive className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-ink">Providers</h1>
        <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">
          {rows.length} providers
        </span>
      </header>

      {/* No `filter`, and not an oversight: the service sends this section an empty
          vocabulary because a provider is already one row per provider. A kind chip
          here would select the row it was built from. */}
      <SummaryBar
        items={[
          { label: "Providers", value: rows.length },
          { label: "Nodes", value: rows.reduce((total, row) => total + row.nodeCount, 0) },
          { label: "Capacity", value: `${rows.reduce((t, r) => t + r.capacityGbps, 0)} Gbps` },
          { label: "Impaired", value: rows.reduce((total, row) => total + row.impaired, 0) },
        ]}
      />

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {rows.length === 0 ? (
          <ListEmpty status={status} filtered={false} noun="providers" />
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-ink-faint">
              <tr>
                <th className="py-1 font-medium">Provider</th>
                <th className="py-1 font-medium">Kinds</th>
                <th className="py-1 font-medium">Countries</th>
                <th className="py-1 text-right font-medium">Nodes</th>
                <th className="py-1 text-right font-medium">Capacity</th>
                <th className="py-1 text-right font-medium">Committed</th>
                <th className="py-1 text-right font-medium">Used</th>
                <th className="py-1 text-right font-medium">Impaired</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.provider}
                  data-row={row.provider}
                  className="border-t border-line text-ink-muted"
                >
                  <td className="py-1">{row.provider}</td>
                  <td className="py-1">
                    {row.kinds.map((kind) => NODE_KIND_TITLES[kind]).join(", ")}
                  </td>
                  <td className="py-1">{row.countries.join(", ")}</td>
                  <td className="py-1 text-right tabular-nums">{row.nodeCount}</td>
                  <td className="py-1 text-right tabular-nums">{row.capacityGbps} Gbps</td>
                  <td className="py-1 text-right tabular-nums">{row.committedGbps} Gbps</td>
                  <td className="py-1 text-right tabular-nums">
                    {(row.utilisationBps / 100).toFixed(2)}%
                  </td>
                  <td className="py-1 text-right tabular-nums">{row.impaired}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/** `infrastructure/providers`, right column: one provider's footprint. */
export function ProvidersDetails({ section }: { section: string | null }): ReactElement {
  const { rows, status } = useProviders();
  const row = rows.find((candidate) => candidate.provider === section) ?? rows[0];

  return (
    <Panel title="Provider footprint">
      {row === undefined ? (
        <Empty>
          {status !== "ready"
            ? emptyMessage({ status, filtered: false, noun: "providers" })
            : "Select a provider to view details"}
        </Empty>
      ) : (
        <KeyValues
          rows={[
            { label: "Provider", value: row.provider },
            { label: "Nodes", value: row.nodeCount },
            { label: "Kinds", value: row.kinds.map((kind) => NODE_KIND_TITLES[kind]).join(", ") },
            { label: "Countries", value: row.countries.join(", ") },
            { label: "Capacity", value: `${row.capacityGbps} Gbps` },
            { label: "Committed", value: `${row.committedGbps} Gbps` },
            { label: "Utilisation", value: `${(row.utilisationBps / 100).toFixed(2)}%` },
            { label: "Impaired", value: row.impaired },
          ]}
        />
      )}
    </Panel>
  );
}
