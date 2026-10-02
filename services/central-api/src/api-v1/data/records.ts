/**
 * Row → record, once per table.
 *
 * Six tables, six mapping functions, and both halves of the API use them: the view
 * services that answer `alerts/feed` and the write services that answer a create.
 * That sharing is the point. A record is assembled twice — once on the way to a
 * panel and once on the way back from an edit — and two assemblies of the same
 * shape drift the moment one of them gains a field. The failure is silent and
 * expensive: the panel shows a column the write path does not send, so the editor
 * for that field drops it on save, and the operator does not find out until the
 * value they changed has reverted.
 *
 * So a new column is one line here, and both answers move together.
 *
 * Every mapper is a plain function over a Drizzle row, taking no database and no
 * aggregate: what these assemble is the *shape*, and the shape is the same however
 * the row was fetched. `slaState` and `instant` are the two conversions that would
 * otherwise be repeated in six places — one that turns two columns into an
 * `SlaCommitment`, one that turns a driver-dependent timestamp into a string.
 */
import { money, slaCommitment } from "@hewa/marketplace-types";
import type {
  Alert,
  ConsoleWriteRecords,
  InfrastructureNode,
  MarketOrder,
  Settlement,
  SlaMonitor,
  SpotRecord,
} from "@hewa/console-types";
import type {
  AlertRow,
  InfrastructureNodeRow,
  MarketOrderRow,
  MarketSpotRow,
  SettlementRow,
  SlaMonitorRow,
} from "../../db/schema.js";
import { instant } from "../../db/instant.js";

/**
 * The record types, keyed by the resource name they answer to.
 *
 * The write contract's own map, re-exported so a caller that has a resource name
 * and wants the record type has one import rather than a `switch`.
 */
export type ConsoleRecords = ConsoleWriteRecords;

/** An alert, as the console draws it. */
export function alertRecord(row: AlertRow): Alert {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    severity: row.severity,
    entityId: row.entityId,
    entityLabel: row.entityLabel,
    provider: row.provider,
    city: row.city,
    lat: row.lat,
    lng: row.lng,
    impactedGbps: row.impactedGbps,
    affectedSlas: row.affectedSlas,
    automatedAction: row.automatedAction,
    raisedAt: instant(row.raisedAt),
  };
}

/** A node, with utilisation as the basis points the contract declares. */
export function nodeRecord(row: InfrastructureNodeRow): InfrastructureNode {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    provider: row.provider,
    city: row.city,
    country: row.country,
    lat: row.lat,
    lng: row.lng,
    capacityGbps: row.capacityGbps,
    utilisationBps: row.utilisationBps,
    status: row.status,
    observedAt: instant(row.observedAt),
  };
}

/** A resting order, with its price as a {@link money} rather than two columns. */
export function orderRecord(row: MarketOrderRow): MarketOrder {
  return {
    id: row.id,
    pool: row.pool,
    side: row.side,
    provider: row.provider,
    committedGbps: row.committedGbps,
    burstGbps: row.burstGbps,
    unitPrice: money(row.priceMinor, row.currency),
    submittedAt: instant(row.submittedAt),
  };
}

/**
 * A spot observation.
 *
 * The only mapper with no view behind it: `market/prices` returns `SpotPoint`s
 * inside a `PriceHistory`, because a chart wants the series and not the rows. The
 * rows still have to be addressable to be corrected, so this is the one record the
 * write contract declares that no read endpoint returns whole.
 */
export function spotRecord(row: MarketSpotRow): SpotRecord {
  return {
    id: String(row.id),
    pool: row.pool,
    priceMinor: row.priceMinor,
    currency: row.currency,
    observedAt: instant(row.observedAt),
  };
}

/** A settlement line, amounts as `Money` so the currency travels with them. */
export function settlementRecord(row: SettlementRow): Settlement {
  return {
    id: row.id,
    batch: row.batch,
    kind: row.kind,
    status: row.status,
    counterparty: row.counterparty,
    amount: money(row.amountMinor, row.currency),
    fee: money(row.feeMinor, row.currency),
    occurredAt: instant(row.occurredAt),
    failureReason: row.failureReason,
  };
}

/**
 * A monitored commitment, with the four basis-point columns reassembled.
 *
 * `state` is read from the column and not recomputed here, on purpose — see the
 * same note in `SlasService.readCommitments`. The column is where the comparison
 * that decides a credit was recorded, and `tests/slas.service.test.ts` asserts the
 * two agree for every row.
 */
export function monitorRecord(row: SlaMonitorRow): SlaMonitor {
  return {
    id: row.id,
    account: row.account,
    nodeId: row.nodeId,
    nodeName: row.nodeName,
    provider: row.provider,
    sla: slaCommitment(row.targetBps, row.actualBps, row.creditNumerator, row.creditDenominator),
    packetLossPpm: row.packetLossPpm,
    latencyP95Ms: row.latencyP95Ms,
    state: row.state,
    measuredAt: instant(row.measuredAt),
  };
}
