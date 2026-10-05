"use client";

import type { ReactElement } from "react";
import { Banknote } from "lucide-react";
import {
  PAYOUT_METHOD_TITLES,
  PAYOUT_STATUS_TITLES,
  PAYOUT_STATUSES,
  type PayoutRecord,
} from "@hewa/financial-dashboard-types";
import { formatMoney } from "@hewa/marketplace-types";
import { canTransitionPayout } from "@hewa/settlement-domain";

import { usePayouts } from "../data/settlement";
import { useFilterParam } from "../state/filter";
import {
  Empty,
  KeyValues,
  RowCount,
  SummaryBar,
  emptyMessage,
  summaryCounts,
  visibleBy,
} from "../ui/primitives";
import { ScopePanel } from "../ui/scope";
import { RecordEditor, asWrite, useRecordWrite } from "../ui/editor";
import { moneyTotals } from "../ui/money";
import { patchPayout } from "../mutations/payouts";

/**
 * The `settlement` view: money leaving the marketplace.
 *
 * One section, one table, and one question behind it — which payouts are stuck. A
 * payout is an obligation that was metered by billing, quoted by the conversion step and
 * then sent, so the row's amount and fee are already settled facts and the only thing
 * an operator can change is where it has got to. That is why the right-hand column is a
 * two-field form rather than an editor of the whole row.
 *
 * ## The state list here is the domain's
 *
 * `PAYOUT_STATUSES` is re-exported from `@hewa/settlement-domain` rather than declared
 * again, and so is `canTransitionPayout`. The form offers the moves that function allows
 * from the row's current state, which means the form cannot offer a state the settlement
 * machine has no edge out of — a chip in a filter bar and a chip in a `<select>` that
 * disagree about which states exist are two vocabularies for one column.
 *
 * The alternative, offering all five statuses and letting the service refuse four of
 * them, teaches the operator that this form's dropdown is where mistakes are caught. It
 * is not: it is a translation layer, and the refusal it avoids is a 422 the operator
 * reads as their mistake rather than as the app's.
 */

/** `settlement/payouts`, left column: the five states, all of them present. */
export function PayoutsScope(): ReactElement {
  const { rows, groups, status } = usePayouts();
  const filter = useFilterParam("payouts-state");

  return (
    <ScopePanel
      label="Filter by state"
      noun="payouts"
      status={status}
      items={summaryCounts(rows, (row) => row.status, {
        keys: groups,
        label: (state) => PAYOUT_STATUS_TITLES[state],
      })}
      selected={filter.selected}
      onToggle={filter.toggle}
      onClear={filter.clear}
    />
  );
}

/**
 * `settlement/payouts`, middle column: every payout and where it got to.
 *
 * The failure reason is a column rather than a row's tooltip because a failed payout is
 * the row an operator has to act on, and the reason is what tells them whether the
 * remedy is to retry the send or to fix an address that is wrong. A table where the
 * reason appears only on hover is a table where it is invisible to a phone.
 */
export function PayoutsPanel(): ReactElement {
  const { rows, status } = usePayouts();
  const filter = useFilterParam("payouts-state");
  const shown = visibleBy(rows, (row) => row.status, filter.selected);

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <Banknote className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-ink">Payouts</h1>
        <RowCount status={status} count={rows.length} noun="payouts" />
      </header>

      <SummaryBar
        items={[
          { label: "Paying out", value: moneyTotals(rows.map((row) => row.amount)) },
          { label: "Stuck", value: rows.filter((row) => row.status === "failed").length },
          {
            label: "Awaiting conversion",
            value: rows.filter((row) => row.status === "converting").length,
          },
        ]}
      />

      <div className="min-h-0 flex-1 overflow-auto main-inset">
        {shown.length === 0 ? (
          <Empty>
            {emptyMessage({
              status,
              filtered: filter.selected.length > 0,
              noun: "payouts",
              filter: "these states",
            })}
          </Empty>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-ink-faint">
              <tr>
                <th className="py-1 font-medium">ISP</th>
                <th className="py-1 font-medium">Method</th>
                <th className="py-1 text-right font-medium">Amount</th>
                <th className="py-1 text-right font-medium">Fee</th>
                <th className="py-1 font-medium">State</th>
                <th className="py-1 font-medium">Reference</th>
                <th className="py-1 font-medium">Occurred</th>
                <th className="py-1 font-medium">Failure</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.id} data-row={row.id} className="border-t border-line text-ink-muted">
                  <td className="py-1">{row.ispName}</td>
                  <td className="py-1">{PAYOUT_METHOD_TITLES[row.method]}</td>
                  <td className="py-1 text-right tabular-nums text-ink">
                    {formatMoney(row.amount)}
                  </td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(row.fee)}</td>
                  <td className="py-1">{PAYOUT_STATUS_TITLES[row.status]}</td>
                  <td className="py-1 font-mono">{row.reference}</td>
                  <td className="py-1">{new Date(row.occurredAt).toLocaleDateString()}</td>
                  <td className="py-1 text-danger">{row.failureReason ?? "—"}</td>
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
 * `settlement/payouts`, right column: move one payout along, and say why it stopped.
 *
 * Two fields, and they go together: moving a payout to `failed` requires a reason and
 * moving one out of `failed` — a retry — must clear it. The service enforces both in the
 * same refinement, so the form asks for the reason whenever the move is to `failed` and
 * the `failureReason` field is left nullable so a retry sends `null` rather than the
 * string that was there before.
 *
 * The states offered are `canTransitionPayout` applied to this row's current state. The
 * current state stays in the list, so the `<select>` shows the state this payout is in
 * rather than opening on the first move available from it: an operator reading the state
 * should not have to remember which of five options it currently holds.
 */
export function PayoutEditor({ section }: { section: string | null }): ReactElement {
  const { rows, refetch } = usePayouts();
  const selected = section ?? null;
  const write = useRecordWrite<PayoutRecord>({
    rows,
    selected,
    keyOf: (row) => row.id,
    save: (id, body) => patchPayout(id, asWrite(body)),
    onSaved: refetch,
  });

  const row = rows.find((candidate) => candidate.id === selected) ?? rows[0];
  const allowed = PAYOUT_STATUSES.filter(
    (status) => status === row?.status || canTransitionPayout(row?.status ?? "completed", status),
  );

  return (
    <RecordEditor
      noun="payout"
      fields={[
        {
          name: "status",
          label: "State",
          kind: "select",
          options: allowed.map((status) => ({
            value: status,
            label: PAYOUT_STATUS_TITLES[status],
          })),
          hint: "Only the moves this payout's current state allows.",
        },
        {
          name: "failureReason",
          label: "Failure reason",
          kind: "multiline",
          nullable: true,
          hint: "Required to fail a payout, cleared when it is retried.",
        },
      ]}
      write={write}
      submitLabel="Save payout state"
      summary={
        row === undefined ? (
          <p className="text-sm text-ink-muted">
            No payout loaded. Pick one in the list; payouts are created by settling a bill.
          </p>
        ) : (
          <KeyValues
            rows={[
              { label: "Payout", value: row.id },
              { label: "ISP", value: `${row.ispName} (${row.ispId})` },
              { label: "Amount", value: formatMoney(row.amount) },
              { label: "Fee", value: formatMoney(row.fee) },
              { label: "Method", value: PAYOUT_METHOD_TITLES[row.method] },
              { label: "Reference", value: row.reference },
            ]}
          />
        )
      }
    />
  );
}
