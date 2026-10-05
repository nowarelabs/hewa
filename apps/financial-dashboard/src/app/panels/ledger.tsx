"use client";

import type { ReactElement } from "react";
import { BookOpenCheck } from "lucide-react";
import { ACCOUNT_TYPE_TITLES, type LedgerAccount } from "@hewa/financial-dashboard-types";
import { formatMoney } from "@hewa/marketplace-types";

import { useLedger } from "../data/ledger";
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
import { moneyTotals } from "../ui/money";
import { createLedgerEntry } from "../mutations/ledger-entries";

/**
 * The `ledger` view: the chart of accounts, and the journal that moves them.
 *
 * One section and one table — one row per account, with the debit and credit totals
 * behind it and the balance they leave. Accounts are not writable here, and that is not
 * an omission: an account's type decides its normal side, which decides what a posting
 * to it means, so a dashboard that could retype an account could silently re-interpret
 * every balance already posted against it. The chart is changed by an accountant in a
 * migration, with a migration's review, not by a select in a side column.
 *
 * ## The one write in this view is a journal entry
 *
 * A posting is the only way the books change here, and it is a create with no patch and
 * no delete — a mistake is corrected by posting a reversing entry, which is another row
 * a reader can see. That is why the right column is a posting form rather than an
 * account editor: the same column, "what may be written about this view", which for the
 * revenue view is a credit and for the proof view is an attestation.
 *
 * ## Postings are a list, and the list is the whole rule
 *
 * `@hewa/ledger-accounting`'s `assertBalanced` is called by the service on the postings
 * it is sent, and this form does not attempt to be a second implementation of it. It
 * shows how many lines there are and it will not let an operator delete below two —
 * because a single-sided entry is not an entry — and then it sends the lines and shows
 * whatever the service says about the difference.
 *
 * What it does *not* do is total the debits against the credits and refuse to submit
 * on a mismatch. Two reasons, and the second is the one that matters: the arithmetic is
 * exact in minor units but the check belongs to the service, and a form that blocks a
 * save on its own arithmetic is a form whose block cannot be tested from the outside. A
 * refusal naming `postings` is more useful than a disabled button with no explanation.
 */

/** `ledger/ledger`, left column: the five account types, all of them present. */
export function AccountsScope(): ReactElement {
  const { accounts } = useLedger();
  const { rows, groups, status } = accounts;
  const filter = useFilterParam("accounts-type");

  return (
    <ScopePanel
      label="Filter by type"
      noun="accounts"
      status={status}
      items={summaryCounts(rows, (row) => row.type, {
        keys: groups,
        label: (type) => ACCOUNT_TYPE_TITLES[type],
      })}
      selected={filter.selected}
      onToggle={filter.toggle}
      onClear={filter.clear}
    />
  );
}

/**
 * `ledger/ledger`, middle column: every account, with what it has been posted.
 *
 * Debit and credit are both drawn and the balance is drawn as the net, because the two
 * totals are the claim and the net is the consequence of them: a balance column alone
 * would let a book balance with every account on the wrong side, which is exactly the
 * case the debit/credit pair exists to make visible. The balance is drawn signed, so a
 * liability's credit balance is negative rather than "negative because the column says
 * so".
 */
export function AccountsPanel(): ReactElement {
  const { accounts } = useLedger();
  const { rows, status } = accounts;
  const filter = useFilterParam("accounts-type");
  const shown = visibleBy(rows, (row) => row.type, filter.selected);

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <BookOpenCheck className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-ink">Accounts</h1>
        <RowCount status={status} count={rows.length} noun="accounts" />
      </header>

      <SummaryBar
        items={[
          { label: "Debits", value: moneyTotals(rows.map((row) => row.debit)) },
          { label: "Credits", value: moneyTotals(rows.map((row) => row.credit)) },
        ]}
      />

      <div className="min-h-0 flex-1 overflow-auto main-inset">
        {shown.length === 0 ? (
          <Empty>
            {emptyMessage({
              status,
              filtered: filter.selected.length > 0,
              noun: "accounts",
              filter: "these types",
            })}
          </Empty>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-ink-faint">
              <tr>
                <th className="py-1 font-medium">Account</th>
                <th className="py-1 font-medium">Type</th>
                <th className="py-1 font-medium">Normal side</th>
                <th className="py-1 text-right font-medium">Debit</th>
                <th className="py-1 text-right font-medium">Credit</th>
                <th className="py-1 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.id} data-row={row.id} className="border-t border-line text-ink-muted">
                  <td className="py-1">
                    {row.name}
                    <span className="ml-1 font-mono text-ink-faint">{row.id}</span>
                  </td>
                  <td className="py-1">{ACCOUNT_TYPE_TITLES[row.type]}</td>
                  <td className="py-1 capitalize">{row.normalSide}</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(row.debit)}</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(row.credit)}</td>
                  <td className="py-1 text-right tabular-nums font-medium text-ink">
                    {formatMoney(row.balance)}
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

/**
 * The account this destination is about, and the entries that moved it.
 *
 * The postings are a projection of the middle column rather than a table of their own:
 * a chart of accounts is browsed one account at a time, and "what moved this account" is
 * the question that follows from picking one. So the account is resolved the same way
 * the editor resolves the row behind it — the selected row where the ids coincide, and
 * otherwise the section's first, which is the row the table is showing above.
 *
 * `entries` carry their postings inline, so this filters one list instead of joining two:
 * there is no postings section to fetch, and a list built by joining would be a second
 * place where an entry's account ids could be read differently from the entry's own.
 */
export function AccountPostings({ section }: { section: string | null }): ReactElement {
  const { accounts, entries } = useLedger();
  const selected = section ?? null;
  const account: LedgerAccount | undefined =
    accounts.rows.find((row) => row.id === selected) ?? accounts.rows[0];

  if (account === undefined) {
    return (
      <Empty>{emptyMessage({ status: accounts.status, filtered: false, noun: "accounts" })}</Empty>
    );
  }

  // `flatMap` rather than `filter` then `find`: pairing each entry with the posting that
  // moved *this* account means the amount below is the account's own, and a fallback for
  // an entry that had none would be a zero balance for an entry that had moved it.
  const moved = entries.rows.flatMap((entry) => {
    const posting = entry.postings.find((candidate) => candidate.accountId === account.id);

    return posting === undefined ? [] : [{ entry, posting }];
  });

  return (
    <div className="space-y-2 text-xs">
      <p className="text-ink-muted">
        <span className="font-medium text-ink">{account.name}</span>
        <span className="ml-1 font-mono text-ink-faint">{account.id}</span>
        <span className="text-ink-faint">
          {` — ${ACCOUNT_TYPE_TITLES[account.type]}, ${account.normalSide}-normal`}
        </span>
      </p>

      {moved.length === 0 ? (
        <p className="text-ink-faint">
          {entries.status === "pending"
            ? "Loading what has moved this account…"
            : "Nothing posted against this account yet."}
        </p>
      ) : (
        <ul className="space-y-1">
          {moved.map(({ entry, posting }) => (
            <li key={entry.id} data-posting={entry.id} className="border-t border-line pt-1">
              <div className="flex justify-between gap-2">
                <span className="truncate text-ink-muted">{entry.description}</span>
                <span className="tabular-nums text-ink">{formatMoney(posting.amount)}</span>
              </div>
              <div className="text-ink-faint">
                <span className="font-mono">{entry.reference}</span>
                <span>{` — ${new Date(entry.occurredAt).toLocaleDateString()}`}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Every column a journal entry create accepts.
 *
 * `postings` is a `lines` field, which is the only list in this dashboard's write
 * contract: two columns per line, and a line count the operator controls. `amountMinor`
 * is signed on both sides — the service decides which side is a debit from the account's
 * normal side, so this form must not offer a "debit or credit" choice per line. It is
 * the account's `type` that says, and a form that asked the operator to repeat it is a
 * form that can be filled in wrongly.
 */
export function ledgerEntryFields(accounts: readonly LedgerAccount[]): readonly FieldSpec[] {
  return [
    editorIdField("ledger_entries"),
    {
      name: "reference",
      label: "Reference",
      kind: "text",
      hint: "Unique. One entry per reference, so a retry under a new id is still refused.",
    },
    { name: "description", label: "Description", kind: "text" },
    { name: "occurredAt", label: "Occurred at", kind: "instant" },
    {
      name: "currency",
      label: "Currency",
      kind: "select",
      options: CURRENCY_FIELDS,
      hint: "Every posting and both accounts must be in this currency.",
    },
    {
      name: "postings",
      label: "Postings",
      kind: "lines",
      minLines: 2,
      itemFields: [
        // A `select` over the accounts this section already holds, rather than a text box
        // for an id the operator has to remember. One read, so it cannot be a second copy
        // of the chart — and a free-text id is the one field here that can be typed wrong
        // in a way nothing downstream would notice until the entry was refused.
        {
          name: "accountId",
          label: "Account",
          kind: "select",
          options: accounts.map((account) => ({
            value: account.id,
            label: `${account.id} — ${account.name}`,
          })),
        },
        {
          name: "amountMinor",
          label: "Amount",
          kind: "number",
          step: 1,
          hint: "minor units, signed: 5000 is 50.00",
        },
      ],
      hint: "Debits must equal credits. The service checks this and names the difference.",
    },
  ];
}

/**
 * `ledger/ledger`, right column, lower half: post a journal entry.
 *
 * Create-only, so the form opens on a blank entry with a generated id and a reference
 * the operator writes. There is no row list behind it: a journal entry is not selected,
 * it is written, and the accounts an entry is posted *against* are named above it.
 */
export function JournalEditor(): ReactElement {
  const { accounts } = useLedger();
  const write = useRecordWrite<LedgerAccount>({
    // The editor's rows are empty on purpose: an entry is never edited, so there is never
    // a record behind the form, and `keyOf` only has to name a row type.
    rows: [],
    selected: null,
    keyOf: (row) => row.id,
    create: (body) => createLedgerEntry(asWrite(body)),
    onSaved: accounts.refetch,
  });

  return (
    <RecordEditor
      noun="journal entry"
      fields={ledgerEntryFields(accounts.rows)}
      write={write}
      submitLabel="Post entry"
    />
  );
}

/**
 * `ledger/ledger`, right column: what moved this account, and the form that moves it.
 *
 * One subject and one column — the account above, the entry below — rather than two
 * columns for one account. They are read and written halves of the same thing: a reader
 * arrives at an account to see what posted to it, and the form is where the next posting
 * goes, so splitting them across two columns puts the question and its answer on
 * opposite sides of the screen with the table of accounts in between.
 */
export function LedgerColumn({ section }: { section: string | null }): ReactElement {
  return (
    <div className="space-y-4">
      <AccountPostings section={section} />
      <JournalEditor />
    </div>
  );
}
