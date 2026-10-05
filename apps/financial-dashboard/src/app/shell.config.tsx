"use client";

import {
  BookOpenCheck,
  FileCheck2,
  FileText,
  Hourglass,
  Landmark,
  Receipt,
  RefreshCw,
  Wallet,
} from "lucide-react";
import type { ShellAction, ShellConfig, StatusSpec, ViewSpec } from "@hewa/app-shell";
import { FINANCE_VIEWS } from "@hewa/financial-dashboard-types";

import {
  BillEditor,
  BillsPanel,
  BillsScope,
  CreditEditor,
  CreditsPanel,
  CreditsScope,
  ReceivableDetails,
  ReceivablesPanel,
  ReceivablesScope,
} from "./panels/revenue";
import { PayoutEditor, PayoutsPanel, PayoutsScope } from "./panels/settlement";
import { AccountsPanel, AccountsScope, LedgerColumn } from "./panels/ledger";
import { AttestationEditor, AttestationsPanel, AttestationsScope } from "./panels/proof";

/**
 * The app.
 *
 * Everything below is data: four views, six destinations, and what each destination's
 * three columns hold. The shell turns that into a title bar, a tab strip, a rail, four
 * columns and a status bar, so there is no component here to keep in step with them.
 *
 * ## A rail button is a destination
 *
 * Six destinations over four views, and the split is the question being asked rather
 * than the table being drawn. `bills` is "what did we issue", `receivables` is "who owes
 * us" — the same rows seen from two ends, and the operator who has to guess which tab
 * holds the row they are looking at is reading a navigation that lies.
 *
 * Every destination carries its own icon. Shared icons tell the reader the buttons are
 * variants of one thing, and bills and receivables are not variants of each other: one
 * is an invoice and the other is a debt.
 *
 * ## Every destination declares a `left`, because `RailItem` requires it
 *
 * The shell's geometry is the same at every rail position, so a rail button that opens a
 * screen one column narrower than its neighbours reads as a column that failed to load —
 * which is exactly what an empty column looks like, which is why neither is offered.
 *
 * All six narrow by the group vocabulary their own section publishes, and all six hold
 * a real one: bill statuses, receivable ages, credit bases, payout states, account types
 * and attestation verdicts. A destination with nothing to narrow by would answer with a
 * search over its rows instead, and none of these six is in that case.
 *
 * ## The right column is whatever that view may write
 *
 * One column, three answers, and each is the view's only write: a bill's state and a
 * credit in `revenue`, a payout's state in `settlement`, a journal entry in `ledger`, an
 * attestation in `proof`. Two of the six are read-only panels — a receivable is derived
 * and has nothing an operator may change — and those say so in the column rather than
 * leaving it empty, because an empty right column is a column that failed to load.
 */

/**
 * The status-line buttons that have no behaviour behind them.
 *
 * Inventing one would be worse than saying so, so `noop` is named for what it is.
 */
const noop = (): void => {};

const refresh: ShellAction = { id: "refresh", label: "Refresh", icon: RefreshCw, onSelect: noop };

/** A status line, given its message and its buttons. */
function statusLine(message: string, actions: readonly ShellAction[]): StatusSpec {
  return { message, actions: [...actions] };
}

const views: Record<string, ViewSpec> = {
  revenue: {
    label: "Revenue",
    longLabel: "Billing and receivables",
    icon: Receipt,
    rail: [
      {
        id: "bills",
        label: "Bills",
        section: "revenue/bills",
        icon: FileText,
        main: { render: BillsPanel },
        left: { title: "State", role: "filter", render: BillsScope },
        right: { title: "Bill", role: "edit", render: BillEditor },
        status: statusLine("Bills issued by the billing run", [refresh]),
      },
      {
        id: "receivables",
        label: "Receivables",
        section: "revenue/receivables",
        icon: Hourglass,
        main: { render: ReceivablesPanel },
        left: { title: "Age", role: "filter", render: ReceivablesScope },
        right: { title: "Receivable", render: ReceivableDetails },
        status: statusLine("What is still owed, aged", [refresh]),
      },
      {
        id: "credits",
        label: "Credits",
        section: "revenue/credits",
        icon: Landmark,
        main: { render: CreditsPanel },
        left: { title: "Basis", role: "filter", render: CreditsScope },
        right: { title: "Credit", role: "edit", render: CreditEditor },
        status: statusLine("Credits issued against bills", [refresh]),
      },
    ],
    fallback: {
      main: { render: BillsPanel },
      left: { title: "State", role: "filter", render: BillsScope },
      right: { title: "Bill", role: "edit", render: BillEditor },
      status: statusLine("Bills issued by the billing run", [refresh]),
    },
  },

  settlement: {
    label: "Settlement",
    longLabel: "Payouts",
    icon: Wallet,
    rail: [
      {
        id: "payouts",
        label: "Payouts",
        section: "settlement/payouts",
        icon: Wallet,
        main: { render: PayoutsPanel },
        left: { title: "State", role: "filter", render: PayoutsScope },
        right: { title: "Payout", role: "edit", render: PayoutEditor },
        status: statusLine("Money leaving the marketplace", [refresh]),
      },
    ],
    fallback: {
      main: { render: PayoutsPanel },
      left: { title: "State", role: "filter", render: PayoutsScope },
      right: { title: "Payout", role: "edit", render: PayoutEditor },
      status: statusLine("Money leaving the marketplace", [refresh]),
    },
  },

  ledger: {
    label: "Ledger",
    longLabel: "Chart of accounts",
    icon: BookOpenCheck,
    rail: [
      {
        id: "ledger",
        label: "Accounts",
        section: "ledger/ledger",
        icon: BookOpenCheck,
        main: { render: AccountsPanel },
        left: { title: "Type", role: "filter", render: AccountsScope },
        right: { title: "Account", role: "edit", render: LedgerColumn },
        status: statusLine("The chart of accounts", [refresh]),
      },
    ],
    fallback: {
      main: { render: AccountsPanel },
      left: { title: "Type", role: "filter", render: AccountsScope },
      right: { title: "Account", role: "edit", render: LedgerColumn },
      status: statusLine("The chart of accounts", [refresh]),
    },
  },

  proof: {
    label: "Proof",
    longLabel: "Revenue attestations",
    icon: FileCheck2,
    rail: [
      {
        id: "attestations",
        label: "Attestations",
        section: "proof/attestations",
        icon: FileCheck2,
        main: { render: AttestationsPanel },
        left: { title: "Verdict", role: "filter", render: AttestationsScope },
        right: { title: "Attestation", role: "edit", render: AttestationEditor },
        status: statusLine("Published days, per city", [refresh]),
      },
    ],
    fallback: {
      main: { render: AttestationsPanel },
      left: { title: "Verdict", role: "filter", render: AttestationsScope },
      right: { title: "Attestation", role: "edit", render: AttestationEditor },
      status: statusLine("Published days, per city", [refresh]),
    },
  },
};

export const config: ShellConfig = {
  brand: { name: "Finance", initials: "FN" },
  defaultView: FINANCE_VIEWS[0],
  views,
  syncUrl: true,
};
