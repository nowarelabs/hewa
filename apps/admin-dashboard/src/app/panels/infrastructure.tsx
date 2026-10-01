"use client";

import type { ReactElement } from "react";
import { Server } from "lucide-react";

import { NODE_KIND_TITLES } from "@hewa/console-types";

import type { PanelProps } from "@hewa/app-shell";
import type { InfrastructureNode, NodeKind } from "../data/infrastructure";
import { useInfrastructure } from "../data/infrastructure";
import { useFilterParam } from "../state/filter";
import {
  CardList,
  Empty,
  KeyValues,
  Panel,
  SummaryBar,
  emptyMessage,
  summaryCounts,
  visibleBy,
} from "../ui/primitives";

/**
 * The `infrastructure` view: every panel the Infrastructure tab can show.
 *
 * One view, one module, named for the key it is registered under in
 * `shell.config.tsx`. The rail picks the kind, the middle column lists the nodes
 * of every kind, and the right column describes one of them.
 */

/**
 * The left column: the nodes of one kind, or all of them.
 *
 * The kind comes from the rail selection, which is already in `item`, so this
 * panel filters the one list it has rather than being registered once per kind.
 */
export function InfrastructureRailPanel({ item }: PanelProps): ReactElement {
  const { rows, status } = useInfrastructure();
  const kind = item === null || item === "all" ? null : item;
  const shown = kind === null ? rows : rows.filter((node) => node.kind === kind);

  return (
    <Panel title={kind === null ? "All nodes" : kind}>
      {shown.length === 0 ? (
        <Empty>
          {emptyMessage({
            status,
            filtered: false,
            noun: kind === null ? "nodes" : `${kind} nodes`,
          })}
        </Empty>
      ) : (
        <CardList
          items={shown.map((node) => ({
            id: node.id,
            title: node.name,
            detail: `${node.provider} · ${node.city}`,
          }))}
        />
      )}
    </Panel>
  );
}

/**
 * The main column: every node, filtered by the kind chips above it.
 *
 * The bar's keys come from `meta.groups` rather than from a list kept here, so a
 * kind nothing is on this week still gets a chip at zero — and a chip that is
 * only sometimes there is a control the operator cannot rely on.
 */
export function InfrastructureList(): ReactElement {
  const { rows, groups, status } = useInfrastructure();
  const filter = useFilterParam("infrastructure");
  const shown = visibleBy(rows, (node) => node.kind, filter.selected as readonly NodeKind[]);

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <Server className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-ink">Infrastructure</h1>
        <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">
          {rows.length} nodes
        </span>
      </header>

      <SummaryBar
        items={summaryCounts(rows, (node) => node.kind, {
          keys: groups,
          // The chip says "Data centre", the row says `data_center`, and the
          // toggle is on the row's value. A label the panel built by
          // upper-casing the first letter would say "Data_center", which is the
          // wire format wearing a display's clothes.
          label: (kind) => NODE_KIND_TITLES[kind],
        })}
        filter={{
          label: "Filter by kind",
          selected: filter.selected,
          onToggle: filter.toggle,
        }}
      />

      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
        {shown.length === 0 ? (
          <Empty>
            {emptyMessage({
              status,
              filtered: filter.selected.length > 0,
              noun: "nodes",
              filter: "these kinds",
            })}
          </Empty>
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
        {node.kind} · {node.provider} · {node.city}, {node.country}
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

/**
 * The right column: one node's commitments and headroom.
 *
 * `state` is read off the row rather than recomputed here. The comparison that
 * produces a breach is the same one a settlement run uses to issue a credit, and
 * a browser that decided it separately would show a commitment as breached that
 * never appears on an invoice.
 */
export function InfrastructureDetailsPanel({ item }: PanelProps): ReactElement {
  const { rows, status } = useInfrastructure();
  const node = rows.find((candidate) => candidate.id === item) ?? rows[0];

  return (
    <Panel title="Node details">
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
            { label: "Kind", value: node.kind },
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
