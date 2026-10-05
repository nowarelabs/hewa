"use client";

import type { ReactElement } from "react";
import { Coins, FileText, Hourglass } from "lucide-react";
import {
  BILL_STATUSES,
  BILL_STATUS_TITLES,
  BILL_TRANSITIONS,
  CREDIT_BASES,
  CREDIT_BASIS_TITLES,
  RECEIVABLE_BUCKET_TITLES,
  type Bill,
  type CreditRecord,
} from "@hewa/financial-dashboard-types";
import { formatMoney } from "@hewa/marketplace-types";

import { useBills, useCredits, useReceivables } from "../data/revenue";
import { useFilterParam } from "../state/filter";
import type { SectionStatus } from "../state/query";
import {
  Empty,
  KeyValues,
  Panel,
  RowCount,
  SummaryBar,
  emptyMessage,
  summaryCounts,
  visibleBy,
} from "../ui/primitives";
import { ScopePanel } from "../ui/scope";
import { RecordEditor, asWrite, editorIdField, type FieldSpec, useRecordWrite } from "../ui/editor";
import { moneyTotals } from "../ui/money";
import { createCredit } from "../mutations/credits";
import { patchBill } from "../mutations/bills";

/**
 * The `revenue` view: what was billed, what is still owed, and what was credited back.
 *
 * Three sections over two tables, and the distinction between them is what each one
 * *adds* rather than which rows it holds:
 *
 * - `bills` is what was issued — every bill, including the paid and the voided ones,
 *   because "did we bill them" is a question about a month and not about a debt.
 * - `receivables` is the same table with the settlement against it and ageing on top,
 *   so it can answer "who do we chase" and `bills` cannot.
 * - `credits` is the correction: money handed back, which is negative and attached to
 *   a bill, and is the only one of the three an operator writes.
 *
 * ## The money columns are never re-derived here
 *
 * A bill's net is the sum of its breakdown and a receivable's outstanding is its total
 * less what has been settled. Both are computed by `@hewa/billing-domain` from integer
 * minor units, and this panel draws what it was given. A table that recomputed them
 * would be a second implementation of the arithmetic that decides what a customer owes,
 * and it would disagree with the invoice by a cent on exactly the rows nobody checked.
 *
 * The one figure summed here is the summary bar's total, and it is a *list* of totals
 * when the rows span currencies: `moneyTotals` adds the minor units per currency rather
 * than converting between them, so a bar reading `4.20 KES, 1200.00 USD` is honest
 * about being two figures and a bar reading `1204.20` would not be.
 */

/** The vocabulary a section's filter bar is built from, drawn once for all three. */
function FinanceScope<TRow, TGroup extends string>({
  rows,
  groups,
  status,
  param,
  noun,
  axis,
  of,
  title,
}: {
  rows: readonly TRow[];
  groups: readonly TGroup[];
  status: SectionStatus;
  param: string;
  noun: string;
  /** "Filter by state", "Filter by age", "Filter by basis". */
  axis: string;
  of: (row: TRow) => TGroup;
  title: (group: TGroup) => string;
}): ReactElement {
  const filter = useFilterParam(param);

  return (
    <ScopePanel
      label={axis}
      noun={noun}
      status={status}
      items={summaryCounts(rows, of, { keys: groups, label: title })}
      selected={filter.selected}
      onToggle={filter.toggle}
      onClear={filter.clear}
    />
  );
}

/** `revenue/bills`, left column: the five states, all of them present. */
export function BillsScope(): ReactElement {
  const { rows, groups, status } = useBills();
  return (
    <FinanceScope
      rows={rows}
      groups={groups}
      status={status}
      param="bills-state"
      noun="bills"
      axis="Filter by state"
      of={(row) => row.status}
      title={(state) => BILL_STATUS_TITLES[state]}
    />
  );
}

/**
 * `revenue/receivables`, left column: the ageing buckets.
 *
 * Every bucket is drawn even at zero, because a collections view whose "90+ days" chip
 * disappears in a good month is a view where the chip an operator presses in a bad one
 * was not there yesterday.
 */
export function ReceivablesScope(): ReactElement {
  const { rows, groups, status } = useReceivables();
  return (
    <FinanceScope
      rows={rows}
      groups={groups}
      status={status}
      param="receivables-age"
      noun="receivables"
      axis="Filter by age"
      of={(row) => row.bucket}
      title={(bucket) => RECEIVABLE_BUCKET_TITLES[bucket]}
    />
  );
}

/** `revenue/credits`, left column: the three bases a credit can be issued under. */
export function CreditsScope(): ReactElement {
  const { rows, groups, status } = useCredits();
  return (
    <FinanceScope
      rows={rows}
      groups={groups}
      status={status}
      param="credits-basis"
      noun="credits"
      axis="Filter by basis"
      of={(row) => row.basis}
      title={(basis) => CREDIT_BASIS_TITLES[basis]}
    />
  );
}

/**
 * The empty state, shared by the three tables.
 *
 * One message rather than three, and it names what is in force: a table showing
 * nothing because a chip is pressed and a table showing nothing because the month has
 * no bills are different facts, and the reader can only tell them apart if the panel
 * says which.
 */
function ListEmpty({
  status,
  filtered,
  noun,
  filter,
}: {
  status: SectionStatus;
  filtered: boolean;
  noun: string;
  filter: string;
}): ReactElement {
  return <Empty>{emptyMessage({ status, filtered, noun, filter })}</Empty>;
}

/**
 * `revenue/bills`, middle column: every bill issued, with the breakdown it was priced on.
 *
 * The breakdown is three money columns rather than one net figure because the net is
 * the sum of the other three and an operator disputing a bill is disputing a *part* of
 * it. A net and a status would leave the question "which line is wrong" unanswerable
 * from the screen.
 */
export function BillsPanel(): ReactElement {
  const { rows, status } = useBills();
  const filter = useFilterParam("bills-state");
  const shown = visibleBy(rows, (row) => row.status, filter.selected);
  const disputed = rows.filter((row) => row.status === "disputed");

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <FileText className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-ink">Bills</h1>
        <RowCount status={status} count={rows.length} noun="bills" />
      </header>

      <SummaryBar
        items={[
          {
            label: "Billed",
            value: moneyTotals(rows.map((row) => row.breakdown.netTotal)),
          },
          { label: "In dispute", value: disputed.length },
          {
            label: "Overdue",
            value: rows.filter((row) => row.status !== "paid" && new Date(row.dueAt) < new Date())
              .length,
          },
        ]}
      />

      <div className="min-h-0 flex-1 overflow-auto main-inset">
        {shown.length === 0 ? (
          <ListEmpty
            status={status}
            filtered={filter.selected.length > 0}
            noun="bills"
            filter="these states"
          />
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-ink-faint">
              <tr>
                <th className="py-1 font-medium">Month</th>
                <th className="py-1 font-medium">ISP</th>
                <th className="py-1 text-right font-medium">Committed</th>
                <th className="py-1 text-right font-medium">Commitment</th>
                <th className="py-1 text-right font-medium">Overage</th>
                <th className="py-1 text-right font-medium">SLA credit</th>
                <th className="py-1 text-right font-medium">Net</th>
                <th className="py-1 font-medium">State</th>
                <th className="py-1 font-medium">Due</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.id} data-row={row.id} className="border-t border-line text-ink-muted">
                  <td className="py-1">{row.month}</td>
                  <td className="py-1">{row.ispName}</td>
                  <td className="py-1 text-right tabular-nums">{row.committedMbps} Mbps</td>
                  <td className="py-1 text-right tabular-nums">
                    {formatMoney(row.breakdown.commitmentCharge)}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {formatMoney(row.breakdown.overageCharge)}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {formatMoney(row.breakdown.slaCredit)}
                  </td>
                  <td className="py-1 text-right tabular-nums font-medium text-ink">
                    {formatMoney(row.breakdown.netTotal)}
                  </td>
                  <td className="py-1">{BILL_STATUS_TITLES[row.status]}</td>
                  <td className="py-1">{new Date(row.dueAt).toLocaleDateString()}</td>
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
 * `revenue/receivables`, middle column: what is still owed, aged.
 *
 * `daysOverdue` is drawn as a figure and not only as a bucket, because the bucket is
 * a four-way bucket of a continuous number and an operator chasing a customer wants to
 * know whether they owe 12 days or 89. Ageing is computed by the service from the
 * settlement it holds; nothing here re-derives it against today's date.
 */
export function ReceivablesPanel(): ReactElement {
  const { rows, status } = useReceivables();
  const filter = useFilterParam("receivables-age");
  const shown = visibleBy(rows, (row) => row.bucket, filter.selected);

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <Hourglass className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-ink">Receivables</h1>
        <RowCount status={status} count={rows.length} noun="receivables" />
      </header>

      <SummaryBar
        items={[
          { label: "Outstanding", value: moneyTotals(rows.map((row) => row.outstanding)) },
          { label: "Over 90 days", value: rows.filter((row) => row.bucket === "d90_plus").length },
        ]}
      />

      <div className="min-h-0 flex-1 overflow-auto main-inset">
        {shown.length === 0 ? (
          <ListEmpty
            status={status}
            filtered={filter.selected.length > 0}
            noun="receivables"
            filter="these ages"
          />
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-ink-faint">
              <tr>
                <th className="py-1 font-medium">Month</th>
                <th className="py-1 font-medium">ISP</th>
                <th className="py-1 text-right font-medium">Total</th>
                <th className="py-1 text-right font-medium">Settled</th>
                <th className="py-1 text-right font-medium">Outstanding</th>
                <th className="py-1 text-right font-medium">Days over</th>
                <th className="py-1 font-medium">Age</th>
                <th className="py-1 font-medium">Due</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr
                  key={row.billId}
                  data-row={row.billId}
                  className="border-t border-line text-ink-muted"
                >
                  <td className="py-1">{row.month}</td>
                  <td className="py-1">{row.ispName}</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(row.total)}</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(row.settled)}</td>
                  <td className="py-1 text-right tabular-nums font-medium text-ink">
                    {formatMoney(row.outstanding)}
                  </td>
                  <td className="py-1 text-right tabular-nums">{row.daysOverdue}</td>
                  <td className="py-1">{RECEIVABLE_BUCKET_TITLES[row.bucket]}</td>
                  <td className="py-1">{new Date(row.dueAt).toLocaleDateString()}</td>
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
 * `revenue/credits`, middle column: money handed back, and why.
 *
 * The amount column is drawn signed rather than as an absolute value with the word
 * "credit" beside it. A credit is a negative figure in the ledger — the same sign
 * `MonthlyBill.slaCredit` carries — and a table that showed `120.00 USD` next to a
 * heading saying "Credits" would read as money owed to us unless the reader already
 * knew the convention.
 */
export function CreditsPanel(): ReactElement {
  const { rows, status } = useCredits();
  const filter = useFilterParam("credits-basis");
  const shown = visibleBy(rows, (row) => row.basis, filter.selected);

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <Coins className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-ink">Credits</h1>
        <RowCount status={status} count={rows.length} noun="credits" />
      </header>

      <SummaryBar
        items={[
          { label: "Credited", value: moneyTotals(rows.map((row) => row.amount)) },
          { label: "Bills touched", value: new Set(rows.map((row) => row.billId)).size },
        ]}
      />

      <div className="min-h-0 flex-1 overflow-auto main-inset">
        {shown.length === 0 ? (
          <ListEmpty
            status={status}
            filtered={filter.selected.length > 0}
            noun="credits"
            filter="these bases"
          />
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-ink-faint">
              <tr>
                <th className="py-1 font-medium">Month</th>
                <th className="py-1 font-medium">ISP</th>
                <th className="py-1 font-medium">Bill</th>
                <th className="py-1 font-medium">Basis</th>
                <th className="py-1 text-right font-medium">Amount</th>
                <th className="py-1 font-medium">Note</th>
                <th className="py-1 font-medium">Recorded</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.id} data-row={row.id} className="border-t border-line text-ink-muted">
                  <td className="py-1">{row.month}</td>
                  <td className="py-1">{row.ispName}</td>
                  <td className="py-1 font-mono">{row.billId}</td>
                  <td className="py-1">{CREDIT_BASIS_TITLES[row.basis]}</td>
                  <td className="py-1 text-right tabular-nums text-ink">
                    {formatMoney(row.amount)}
                  </td>
                  <td className="py-1">{row.note}</td>
                  <td className="py-1">{new Date(row.recordedAt).toLocaleDateString()}</td>
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
 * `revenue/receivables`, right column: one receivable, and why there is no form.
 *
 * A receivable is the difference between a bill and a settlement, so every column of it
 * is derived from a row the billing run wrote and a row the settlement run wrote. An
 * edit here would be an operator typing a number that two other tables already
 * disagree about, which is the one thing this dashboard cannot offer.
 *
 * So the panel says that, in the column where a form would be, rather than showing an
 * empty one: a column with no form and no explanation is a column that failed to load.
 */
export function ReceivableDetails({ section }: { section: string | null }): ReactElement {
  const { rows, status } = useReceivables();
  const row = rows.find((candidate) => candidate.billId === section) ?? rows[0];

  return (
    <Panel title="Receivable">
      {row === undefined ? (
        <Empty>
          {status === "ready"
            ? "Nothing is outstanding"
            : emptyMessage({ status, filtered: false, noun: "receivables" })}
        </Empty>
      ) : (
        <KeyValues
          rows={[
            { label: "ISP", value: `${row.ispName} (${row.ispId})` },
            { label: "Month", value: row.month },
            { label: "Total", value: formatMoney(row.total) },
            { label: "Settled", value: formatMoney(row.settled) },
            { label: "Outstanding", value: formatMoney(row.outstanding) },
            { label: "Due", value: new Date(row.dueAt).toLocaleDateString() },
            { label: "Days over", value: row.daysOverdue },
            { label: "Age", value: RECEIVABLE_BUCKET_TITLES[row.bucket] },
            { label: "Bill", value: row.billId },
            {
              label: "Edited here",
              value: "No — a receivable is a bill less its settlement",
            },
          ]}
        />
      )}
    </Panel>
  );
}

/**
 * `revenue/bills`, right column: the two fields a bill's state is made of.
 *
 * Two inputs for a row that carries nine. The charges were metered and the breakdown
 * is their sum, so a form that showed them would be inviting an operator to re-price a
 * month; they are in the summary above the form instead, read-only, so the operator can
 * see what they are disputing before they type why.
 *
 * `status` offers only the transitions the contract allows from where this bill
 * currently is, because offering all five would be offering four refusals. The list
 * comes from `BILL_TRANSITIONS` — the same table the service enforces — so the form
 * cannot offer a move the service has no edge for, and the two cannot drift.
 */
export function BillEditor({ section }: { section: string | null }): ReactElement {
  const { rows, refetch } = useBills();
  const selected = section ?? null;
  const write = useRecordWrite<Bill>({
    rows,
    selected,
    keyOf: (row) => row.id,
    save: (id, body) => patchBill(id, asWrite(body)),
    onSaved: refetch,
  });

  const row = rows.find((candidate) => candidate.id === selected) ?? rows[0];
  // The current state plus every state it may move to, from the contract's own table.
  const allowed = BILL_STATUSES.filter(
    (status) => status === row?.status || BILL_TRANSITIONS[row?.status ?? "paid"].includes(status),
  );

  return (
    <RecordEditor
      noun="bill"
      fields={[
        {
          name: "status",
          label: "State",
          kind: "select",
          options: allowed.map((status) => ({ value: status, label: BILL_STATUS_TITLES[status] })),
          hint: "Only the moves this bill's current state allows.",
        },
        {
          name: "disputeReason",
          label: "Dispute reason",
          kind: "multiline",
          nullable: true,
          hint: "Required to dispute a bill, cleared when the dispute is resolved.",
        },
      ]}
      write={write}
      submitLabel="Save bill state"
      summary={
        row === undefined ? (
          <p className="text-sm text-ink-muted">
            No bill loaded. Pick one in the list; bills are issued by the billing run.
          </p>
        ) : (
          <KeyValues
            rows={[
              { label: "Bill", value: row.id },
              { label: "Month", value: row.month },
              { label: "Commitment", value: formatMoney(row.breakdown.commitmentCharge) },
              { label: "Overage", value: formatMoney(row.breakdown.overageCharge) },
              { label: "SLA credit", value: formatMoney(row.breakdown.slaCredit) },
              { label: "Net", value: formatMoney(row.breakdown.netTotal) },
            ]}
          />
        )
      }
    />
  );
}

/**
 * Every column a credit create accepts.
 *
 * `amountMinor` in minor units and signed, because that is the column: `12.34 USD` in
 * the field would be a figure this form has to parse, and `-1234` in the field is the
 * number the database holds. The hint says so, because a field labelled "Amount" that
 * wants minor units is a field somebody will type `12.34` into.
 *
 * `billId` is text rather than a picker because the list of bills is this panel's other
 * section and a form that opened a second list to fill one field would be two answers
 * to "which bill is this for".
 */
export const CREDIT_FIELDS: readonly FieldSpec[] = [
  editorIdField("credits"),
  {
    name: "billId",
    label: "Bill id",
    kind: "text",
    hint: "The bill this credit comes off, e.g. bil-…",
  },
  {
    name: "amountMinor",
    label: "Amount",
    kind: "number",
    step: 1,
    hint: "minor units, negative: -1234 is 12.34 USD back",
  },
  {
    name: "basis",
    label: "Basis",
    kind: "select",
    options: CREDIT_BASES.map((basis) => ({ value: basis, label: CREDIT_BASIS_TITLES[basis] })),
  },
  { name: "note", label: "Note", kind: "multiline", hint: "What the credit was for. Required." },
  { name: "recordedAt", label: "Recorded at", kind: "instant" },
];

/**
 * `revenue/credits`, right column: issue a credit.
 *
 * Create and never patch, so the editor opens on a blank credit with a generated id and
 * offers no save for one that already exists. The note is a field rather than a
 * footnote because the service requires it: a credit nobody can explain is the one
 * figure in this view that will be questioned later.
 */
export function CreditEditor(): ReactElement {
  const { rows, refetch } = useCredits();
  const write = useRecordWrite<CreditRecord>({
    rows,
    selected: null,
    keyOf: (row) => row.id,
    create: (body) => createCredit(asWrite(body)),
    // No `save`: `FINANCE_WRITE_VERBS.credits` is `["POST"]`, so the editor opens in
    // `new` and has no mode in which it could edit one that already exists.
    onSaved: refetch,
  });

  return (
    <RecordEditor
      noun="credit"
      fields={CREDIT_FIELDS}
      write={write}
      submitLabel="Issue credit"
      summary={
        <p className="text-sm text-ink-muted">
          A credit is issued whole and attached to a bill. Nothing here edits a credit that has
          already been issued.
        </p>
      }
    />
  );
}
