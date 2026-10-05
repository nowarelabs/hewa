"use client";

import type { ReactElement } from "react";
import { FileCheck2 } from "lucide-react";
import {
  ATTESTATION_VERDICT_TITLES,
  type AttestationRecord,
} from "@hewa/financial-dashboard-types";
import { formatMoney } from "@hewa/marketplace-types";

import { useAttestations } from "../data/proof";
import { useFilterParam } from "../state/filter";
import {
  Empty,
  RowCount,
  SummaryBar,
  emptyMessage,
  summaryCounts,
  visibleBy,
} from "../ui/primitives";
import { ScopePanel } from "../ui/scope";
import {
  CURRENCY_FIELDS,
  RecordEditor,
  asWrite,
  editorIdField,
  type FieldSpec,
  useRecordWrite,
} from "../ui/editor";
import { createAttestation } from "../mutations/attestations";

/**
 * The `proof` view: a published day's revenue, per city.
 *
 * One section, one table, and the row's verdict is the section's whole vocabulary. An
 * attestation is one city's revenue for one day, signed and published, and the question
 * a reader brings to this view is "which days are short" — so the filter bar holds the
 * verdict and nothing else, and the main column states the two figures the verdict is
 * derived from.
 *
 * ## Creating one is publishing it
 *
 * There is no draft attestation and no patch. The row does not exist until it is signed
 * and published, so the form's five inputs are the whole payload: `grossMinor` and
 * `costsMinor` and where they went. The Merkle root, the signature, the verdict and the
 * publish time are all produced by `@hewa/revenue-proof-protocol`'s attestation job, and
 * a form that could send them would be a web form asserting a proof.
 *
 * Which is also why the net is not a field: it is `gross - costs`, computed by the
 * service with the same integer subtraction every other net in this workspace uses. A
 * third input would be a third figure for one day's money, and it would be the one an
 * operator could get wrong.
 */

/** `proof/attestations`, left column: complete or partial, both always present. */
export function AttestationsScope(): ReactElement {
  const { rows, groups, status } = useAttestations();
  const filter = useFilterParam("attestations-verdict");

  return (
    <ScopePanel
      label="Filter by verdict"
      noun="attestations"
      status={status}
      items={summaryCounts(rows, (row) => row.verdict, {
        keys: groups,
        label: (verdict) => ATTESTATION_VERDICT_TITLES[verdict],
      })}
      selected={filter.selected}
      onToggle={filter.toggle}
      onClear={filter.clear}
    />
  );
}

/**
 * `proof/attestations`, middle column: one row per city-day.
 *
 * Gross, costs and net are all drawn, in that order, because the net is their
 * arithmetic and a reader checking the proof wants to see the two it was made from. The
 * verdict column says whether the day was fully attested, which is a claim about the
 * proof rather than about the money.
 */
export function AttestationsPanel(): ReactElement {
  const { rows, status } = useAttestations();
  const filter = useFilterParam("attestations-verdict");
  const shown = visibleBy(rows, (row) => row.verdict, filter.selected);

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <FileCheck2 className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-ink">Attestations</h1>
        <RowCount status={status} count={rows.length} noun="attestations" />
      </header>

      <SummaryBar
        items={[
          { label: "Cities", value: new Set(rows.map((row) => row.city)).size },
          { label: "Partial", value: rows.filter((row) => row.verdict === "partial").length },
        ]}
      />

      <div className="min-h-0 flex-1 overflow-auto main-inset">
        {shown.length === 0 ? (
          <Empty>
            {emptyMessage({
              status,
              filtered: filter.selected.length > 0,
              noun: "attestations",
              filter: "these verdicts",
            })}
          </Empty>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-ink-faint">
              <tr>
                <th className="py-1 font-medium">City</th>
                <th className="py-1 font-medium">Month</th>
                <th className="py-1 text-right font-medium">Day</th>
                <th className="py-1 text-right font-medium">Gross</th>
                <th className="py-1 text-right font-medium">Costs</th>
                <th className="py-1 text-right font-medium">Net</th>
                <th className="py-1 font-medium">Verdict</th>
                <th className="py-1 font-medium">Published</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.id} data-row={row.id} className="border-t border-line text-ink-muted">
                  <td className="py-1">{row.city}</td>
                  <td className="py-1">{row.month}</td>
                  <td className="py-1 text-right tabular-nums">{row.day}</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(row.gross)}</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(row.costs)}</td>
                  <td className="py-1 text-right tabular-nums font-medium text-ink">
                    {formatMoney(row.netRevenue)}
                  </td>
                  <td className="py-1">{ATTESTATION_VERDICT_TITLES[row.verdict]}</td>
                  <td className="py-1">{new Date(row.publishedAt).toLocaleString()}</td>
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
 * Every column an attestation create accepts.
 *
 * `month` and `day` as two inputs rather than one date, because that is what the contract
 * stores and the attestation job indexes on: a `datetime-local` input would be a value
 * this form has to split, and the time component would be a field nothing reads.
 *
 * The currency is a `select` from the contract's own list, because a proof is signed over
 * an amount in a named currency and a currency a form cannot offer is a currency nothing
 * can be attested in.
 */
export const ATTESTATION_FIELDS: readonly FieldSpec[] = [
  editorIdField("attestations"),
  { name: "city", label: "City", kind: "text" },
  { name: "month", label: "Month", kind: "text", hint: "YYYY-MM, e.g. 2026-09" },
  { name: "day", label: "Day", kind: "number", min: 1, max: 31, step: 1 },
  // `CURRENCY_FIELDS` rather than a list written here: it is the one list every money
  // field in this app draws from, so a currency added to `@hewa/marketplace-types` is
  // offerable everywhere at once.
  { name: "currency", label: "Currency", kind: "select", options: CURRENCY_FIELDS },
  {
    name: "grossMinor",
    label: "Gross",
    kind: "number",
    min: 0,
    step: 1,
    hint: "minor units: 500000 is 5000.00",
  },
  {
    name: "costsMinor",
    label: "Costs",
    kind: "number",
    min: 0,
    step: 1,
    hint: "minor units, not negative",
  },
];

/**
 * `proof/attestations`, right column: publish one day's revenue for one city.
 *
 * The form has no row list behind it for the same reason the journal entry does not: an
 * attestation is written, never selected. Its read side is the table in the middle
 * column, and the summary above the form states the net the two inputs imply rather than
 * repeating a row that does not exist yet.
 */
export function AttestationEditor(): ReactElement {
  const { refetch } = useAttestations();
  const write = useRecordWrite<AttestationRecord>({
    // No rows: nothing here is ever edited, so there is never a record to open.
    rows: [],
    selected: null,
    keyOf: (row) => row.id,
    create: (body) => createAttestation(asWrite(body)),
    onSaved: refetch,
  });

  return (
    <RecordEditor
      noun="attestation"
      fields={ATTESTATION_FIELDS}
      write={write}
      submitLabel="Publish attestation"
      summary={
        <p className="text-sm text-ink-muted">
          Publishing signs the day. The root, the signature and the verdict are the attestation
          job's, not this form's.
        </p>
      }
    />
  );
}
