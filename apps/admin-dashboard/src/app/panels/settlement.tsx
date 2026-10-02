"use client";

import type { ReactElement, ReactNode } from "react";
import { ArrowRightLeft, Coins, Layers } from "lucide-react";
import {
  SETTLEMENT_KINDS,
  SETTLEMENT_KIND_TITLES,
  type Settlement,
  type SettlementWrite,
  type SettlementRun,
} from "@hewa/console-types";
import {
  TRANSACTION_STATUSES,
  TRANSACTION_STATUS_TITLES,
  formatMoney,
  type TransactionStatus,
} from "@hewa/marketplace-types";

import { useMovements, usePayouts, useRuns } from "../data/settlement";
import { useFilterParam } from "../state/filter";
import { Empty, KeyValues, Panel, emptyMessage, summaryCounts, visibleBy } from "../ui/primitives";
import { ScopePanel } from "../ui/scope";
import {
  CURRENCY_FIELDS,
  RecordEditor,
  asWrite,
  editorIdField,
  type FieldSpec,
  useRecordWrite,
} from "../ui/editor";
import { createSettlement, patchSettlement } from "../mutations/settlements";

/**
 * The `settlement` view's panels: three per section, and the middle column of each.
 *
 * The three sections narrow on different axes, and that is the difference between
 * them: `movements` narrows by kind because the question is "what is this flow", `runs`
 * narrows by state because the question is "did it balance", and `payouts` narrows by
 * transaction status because the question is "did the money arrive". A toggle that
 * narrowed runs by kind would select nothing useful — a batch's kinds are an array, not
 * a group the row belongs to.
 */

/**
 * The two states a run can be in, as the vocabulary rather than as whatever is here.
 *
 * `TransactionStatus` has four members and a run is in exactly two of them by
 * definition, so this is a narrowed `readonly TransactionStatus[]` and not a new
 * string union — the titles come from the ledger's own vocabulary instead of a second
 * spelling of `failed`.
 */
const RUN_STATES: readonly TransactionStatus[] = ["completed", "failed"];

function ListEmpty({
  status,
  filtered,
  noun,
}: {
  status: "pending" | "failed" | "ready";
  filtered: boolean;
  noun: string;
}): ReactElement {
  return <Empty>{emptyMessage({ status, filtered, noun, filter: "the filter" })}</Empty>;
}

/** `settlement/movements`, left column: what kind of movement. */
export function MovementsScope(): ReactElement {
  const { rows, groups, status } = useMovements();
  const filter = useFilterParam("settlement-movements");

  return (
    <ScopePanel
      label="Filter by kind"
      noun="movements"
      status={status}
      items={summaryCounts(rows, (row) => row.kind, {
        keys: groups,
        label: (kind) => SETTLEMENT_KIND_TITLES[kind],
      })}
      selected={filter.selected}
      onToggle={filter.toggle}
      onClear={filter.clear}
    />
  );
}

/**
 * `settlement/runs`, left column: the derived state pair.
 *
 * A run has no status of its own — a batch is a mix of completed and failed lines, so
 * its state is this pair rather than the transaction vocabulary `meta.groups` names.
 * Both are stated outright instead of being derived from the rows: a run that
 * currently holds no failed line would otherwise lose its "failed" toggle, and a
 * control that appears and disappears with the data is a control that is only
 * sometimes there.
 */
export function RunsScope(): ReactElement {
  const { rows, status } = useRuns();
  const filter = useFilterParam("settlement-runs");

  return (
    <ScopePanel
      label="Filter runs"
      noun="runs"
      status={status}
      items={summaryCounts(rows, (row) => (row.failed > 0 ? "failed" : "completed"), {
        keys: RUN_STATES,
        label: (key) => TRANSACTION_STATUS_TITLES[key],
      })}
      selected={filter.selected}
      onToggle={filter.toggle}
      onClear={filter.clear}
    />
  );
}

/** `settlement/payouts`, left column: where the money got to. */
export function PayoutsScope(): ReactElement {
  const { rows, groups, status } = usePayouts();
  const filter = useFilterParam("settlement-payouts");

  return (
    <ScopePanel
      label="Filter by status"
      noun="payouts"
      status={status}
      items={summaryCounts(rows, (row) => row.status, {
        keys: groups,
        label: (value) => TRANSACTION_STATUS_TITLES[value],
      })}
      selected={filter.selected}
      onToggle={filter.toggle}
      onClear={filter.clear}
    />
  );
}

/** `settlement/movements`, middle column: every movement of value. */
export function MovementsPanel(): ReactElement {
  const { rows, status } = useMovements();
  const filter = useFilterParam("settlement-movements");
  const shown = visibleBy(rows, (row) => row.kind, filter.selected);

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <ArrowRightLeft className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-ink">Movements</h1>
        <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">
          {rows.length} lines
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-auto main-inset">
        {shown.length === 0 ? (
          <ListEmpty status={status} filtered={filter.selected.length > 0} noun="movements" />
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-ink-faint">
              <tr>
                <th className="py-1 font-medium">Batch</th>
                <th className="py-1 font-medium">Kind</th>
                <th className="py-1 font-medium">Counterparty</th>
                <th className="py-1 font-medium">Status</th>
                <th className="py-1 text-right font-medium">Amount</th>
                <th className="py-1 text-right font-medium">Fee</th>
                <th className="py-1 font-medium">Occurred</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.id} data-row={row.id} className="border-t border-line text-ink-muted">
                  <td className="py-1">{row.batch}</td>
                  <td className="py-1">{SETTLEMENT_KIND_TITLES[row.kind]}</td>
                  <td className="py-1">{row.counterparty}</td>
                  <td className="py-1">
                    {TRANSACTION_STATUS_TITLES[row.status]}
                    {row.failureReason === null ? null : (
                      <span className="block text-ink-faint">{row.failureReason}</span>
                    )}
                  </td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(row.amount)}</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(row.fee)}</td>
                  <td className="py-1">{new Date(row.occurredAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/**
 * `settlement/runs`, middle column: one row per batch and currency.
 *
 * The currency is a column rather than part of the batch label because it is what
 * makes the row unique — a batch split across two currencies is two rows with two
 * nets, and merging them would be a sum in minor units of nothing.
 */
export function RunsPanel(): ReactElement {
  const { rows, status } = useRuns();
  const filter = useFilterParam("settlement-runs");
  const shown = visibleBy(
    rows,
    (row) => (row.failed > 0 ? "failed" : "completed"),
    filter.selected,
  );

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <Layers className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-ink">Runs</h1>
        <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">
          {rows.length} runs
        </span>
      </header>

      {/* A run has no status of its own, so its vocabulary is the derived pair in the
          left column rather than anything `meta.groups` names. */}
      <div className="min-h-0 flex-1 overflow-auto main-inset">
        {shown.length === 0 ? (
          <ListEmpty status={status} filtered={filter.selected.length > 0} noun="runs" />
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-ink-faint">
              <tr>
                <th className="py-1 font-medium">Batch</th>
                <th className="py-1 font-medium">Currency</th>
                <th className="py-1 font-medium">Kinds</th>
                <th className="py-1 text-right font-medium">Lines</th>
                <th className="py-1 text-right font-medium">Failed</th>
                <th className="py-1 text-right font-medium">Gross</th>
                <th className="py-1 text-right font-medium">Fees</th>
                <th className="py-1 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr
                  key={`${row.batch}/${row.currency}`}
                  data-row={`${row.batch}/${row.currency}`}
                  className="border-t border-line text-ink-muted"
                >
                  <td className="py-1">{row.batch}</td>
                  <td className="py-1">{row.currency}</td>
                  <td className="py-1">
                    {row.kinds.map((kind) => SETTLEMENT_KIND_TITLES[kind]).join(", ")}
                  </td>
                  <td className="py-1 text-right tabular-nums">{row.lineCount}</td>
                  <td className="py-1 text-right tabular-nums">{row.failed}</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(row.gross)}</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(row.fees)}</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(row.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/** `settlement/runs`, right column: one run's totals. */
export function RunsDetails({ section }: { section: string | null }): ReactElement {
  const { rows, status } = useRuns();
  const row =
    rows.find((candidate) => `${candidate.batch}/${candidate.currency}` === section) ?? rows[0];

  return (
    <Panel title="Run">
      {row === undefined ? (
        <Empty>
          {status !== "ready"
            ? emptyMessage({ status, filtered: false, noun: "runs" })
            : "Select a run to view details"}
        </Empty>
      ) : (
        <RunFigures row={row} />
      )}
    </Panel>
  );
}

/** One run's totals, shared by the runs columns. */
export function RunFigures({ row }: { row: SettlementRun }): ReactElement {
  return (
    <KeyValues
      rows={[
        { label: "Batch", value: row.batch },
        { label: "Currency", value: row.currency },
        { label: "Kinds", value: row.kinds.map((kind) => SETTLEMENT_KIND_TITLES[kind]).join(", ") },
        { label: "Lines", value: row.lineCount },
        { label: "Failed", value: row.failed },
        { label: "Gross", value: formatMoney(row.gross) },
        { label: "Fees", value: formatMoney(row.fees) },
        { label: "Net", value: formatMoney(row.net) },
        { label: "Started", value: new Date(row.startedAt).toLocaleString() },
        {
          label: "Completed",
          value: row.completedAt === null ? "—" : new Date(row.completedAt).toLocaleString(),
        },
      ]}
    />
  );
}

/** `settlement/payouts`, middle column: money leaving for an ISP. */
export function PayoutsPanel(): ReactElement {
  const { rows, status } = usePayouts();
  const filter = useFilterParam("settlement-payouts");
  const shown = visibleBy(rows, (row) => row.status, filter.selected);

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <Coins className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-ink">Payouts</h1>
        <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">
          {rows.length} payouts
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-auto main-inset">
        {shown.length === 0 ? (
          <ListEmpty status={status} filtered={filter.selected.length > 0} noun="payouts" />
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-ink-faint">
              <tr>
                <th className="py-1 font-medium">Batch</th>
                <th className="py-1 font-medium">Counterparty</th>
                <th className="py-1 font-medium">Status</th>
                <th className="py-1 text-right font-medium">Amount</th>
                <th className="py-1 text-right font-medium">Fee</th>
                <th className="py-1 text-right font-medium">Net</th>
                <th className="py-1 font-medium">Occurred</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.id} data-row={row.id} className="border-t border-line text-ink-muted">
                  <td className="py-1">{row.batch}</td>
                  <td className="py-1">{row.counterparty}</td>
                  <td className="py-1">
                    {TRANSACTION_STATUS_TITLES[row.status]}
                    {row.failureReason === null ? null : (
                      <span className="block text-ink-faint">{row.failureReason}</span>
                    )}
                  </td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(row.amount)}</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(row.fee)}</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(row.net)}</td>
                  <td className="py-1">{new Date(row.occurredAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/** `settlement/payouts`, right column: one payout's figures. */
export function PayoutsDetails({ section }: { section: string | null }): ReactElement {
  const { rows, status } = usePayouts();
  const row = rows.find((candidate) => candidate.id === section) ?? rows[0];

  return (
    <Panel title="Payout">
      {row === undefined ? (
        <Empty>
          {status !== "ready"
            ? emptyMessage({ status, filtered: false, noun: "payouts" })
            : "Select a payout to view details"}
        </Empty>
      ) : (
        <KeyValues
          rows={[
            { label: "Batch", value: row.batch },
            { label: "Counterparty", value: row.counterparty },
            { label: "Status", value: TRANSACTION_STATUS_TITLES[row.status] },
            { label: "Amount", value: formatMoney(row.amount) },
            { label: "Fee", value: formatMoney(row.fee) },
            { label: "Net", value: formatMoney(row.net) },
            { label: "Occurred", value: new Date(row.occurredAt).toLocaleString() },
            { label: "Reason", value: row.failureReason ?? "—" },
          ]}
        />
      )}
    </Panel>
  );
}

/**
 * `settlement/movements`, right column: the movement this section is about, editable.
 *
 * No Delete, and the reason is the ledger rather than the API: a movement that has
 * been paid and then deleted is indistinguishable from one that was never paid, and
 * that is the one ambiguity a settlement record cannot carry. A line that was wrong
 * is reversed, and the reversal is another line — so `status` is a field and
 * `failureReason` is nullable, because a failed movement says why.
 *
 * The amounts are minor units, whole and exact. Nothing here converts to a decimal
 * and back: money in this system is an integer count of the smallest unit precisely
 * so that a figure an operator retypes and a figure the service stores are the same
 * number.
 */
export function SettlementEditor({ section }: { section: string | null }): ReactElement {
  const { rows: movements, refetch } = useMovements();
  const rows = movements.map(settlementWriteFields);

  const write = useRecordWrite<SettlementWriteRow>({
    rows,
    selected: section,
    keyOf: (row) => row.id,
    create: (body) => createSettlement(asWrite(body)),
    save: (id, body) => patchSettlement(id, asWrite(body)),
    onSaved: refetch,
  });

  const row = movements.find((candidate) => candidate.id === section) ?? movements[0];

  return (
    <RecordEditor
      noun="movement"
      fields={SETTLEMENT_FIELDS}
      write={write}
      submitLabel="Save movement"
      summary={row === undefined ? undefined : <KeyValues rows={movementSummary(row)} />}
    />
  );
}

/**
 * A movement in the shape a write takes, with the id the panel addresses it by.
 */
type SettlementWriteRow = SettlementWrite & { readonly id: string };

/**
 * A movement as the columns a write carries.
 *
 * A read record holds `amount` and `fee` as `Money` objects, because a table draws
 * each one beside its currency; a write takes `amountMinor`, `feeMinor` and one
 * `currency` for the row. Both money columns of a movement are in the same currency
 * — that is what a single row means — so the currency is read off the amount rather
 * than asked about.
 */
function settlementWriteFields(row: Settlement): SettlementWriteRow {
  return {
    id: row.id,
    batch: row.batch,
    kind: row.kind,
    status: row.status,
    counterparty: row.counterparty,
    amountMinor: row.amount.amountMinor,
    feeMinor: row.fee.amountMinor,
    currency: row.amount.currency,
    occurredAt: row.occurredAt,
    failureReason: row.failureReason,
  };
}

/**
 * The movement's figures, for the editor's read-only strip.
 *
 * The amounts are shown as money and entered as minor units, and `formatMoney` is
 * the only function that does the conversion — the same one that draws them in the
 * table, so the figure the operator checks is the figure they are correcting.
 */
export function movementSummary(row: Settlement): { label: string; value: ReactNode }[] {
  return [
    { label: "Batch", value: row.batch },
    { label: "Kind", value: SETTLEMENT_KIND_TITLES[row.kind] },
    { label: "Counterparty", value: row.counterparty },
    { label: "Status", value: TRANSACTION_STATUS_TITLES[row.status] },
    { label: "Amount", value: formatMoney(row.amount) },
    { label: "Fee", value: formatMoney(row.fee) },
    { label: "Occurred", value: new Date(row.occurredAt).toLocaleString() },
    { label: "Reason", value: row.failureReason ?? "—" },
  ];
}

/** Every column `SettlementWrite` accepts. */
export const SETTLEMENT_FIELDS: readonly FieldSpec[] = [
  editorIdField("settlements"),
  { name: "batch", label: "Batch", kind: "text" },
  {
    name: "kind",
    label: "Kind",
    kind: "select",
    options: SETTLEMENT_KINDS.map((value) => ({ value, label: value })),
  },
  {
    name: "status",
    label: "Status",
    kind: "select",
    options: TRANSACTION_STATUSES.map((value) => ({ value, label: value })),
  },
  { name: "counterparty", label: "Counterparty", kind: "text" },
  {
    name: "amountMinor",
    label: "Amount",
    kind: "number",
    step: 1,
    hint: "minor units of the currency: 670000 is $6,700.00",
  },
  { name: "feeMinor", label: "Fee", kind: "number", step: 1, hint: "minor units" },
  { name: "currency", label: "Currency", kind: "select", options: CURRENCY_FIELDS },
  { name: "occurredAt", label: "Occurred at", kind: "instant" },
  {
    name: "failureReason",
    label: "Failure reason",
    kind: "text",
    nullable: true,
    hint: "empty unless the status is failed",
  },
];
