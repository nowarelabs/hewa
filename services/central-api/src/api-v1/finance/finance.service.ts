import { Inject, Injectable } from "@nestjs/common";
import {
  ATTESTATION_VERDICTS,
  RECEIVABLE_BUCKETS,
  type AttestationRecord,
  type AttestationVerdict,
  type Bill,
  type BillStatus,
  type CreditBasis,
  type CreditRecord,
  type FinanceEnvelope,
  type LedgerSection,
  type PayoutRecord,
  type PayoutStatus,
  type Receivable,
  type ReceivableBucket,
} from "@hewa/financial-dashboard-types";
import type { AccountType } from "@hewa/ledger-accounting";
import { money, type Currency } from "@hewa/marketplace-types";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";

import { CLOCK, daysBetween } from "../../db/clock.js";
import { DB, type Database } from "../../db/db.module.js";
import {
  accountTypeEnum,
  billStatusEnum,
  creditBasisEnum,
  financeAttestations,
  financeBills,
  financeCredits,
  financeLedgerAccounts,
  financeLedgerEntries,
  financeLedgerPostings,
  financePayouts,
  financePayoutStatusEnum,
} from "../../db/schema.js";
import { envelope } from "../envelope.js";
import { receivableBucket } from "./ageing.js";
import {
  accountRecords,
  attestationsWithVerdicts,
  attestationRecord,
  billRecord,
  creditRecord,
  journalEntries,
  ledgerAccountRecords,
  ledgerEntryRecords,
  payoutRecord,
} from "./records.js";

/** The statuses a receivable is read from. */
const RECEIVABLE_STATUSES = ["issued", "disputed"] as const satisfies readonly BillStatus[];

/**
 * The six finance sections, over the seven finance tables.
 *
 * ## Why one service rather than six
 *
 * Because six sections here are not six independent questions. `revenue/receivables`
 * is `finance_bills` with an ageing rule over it and a credit sum folded in;
 * `revenue/bills` is the same rows without those two. Splitting them across providers
 * would mean the receipt criterion — which statuses count as owed — living in one
 * place and the invoice criterion in another, and the two disagreeing quietly the
 * first time a status is added.
 *
 * ## Why the clock is injected
 *
 * Because `revenue/receivables` is a function of the current date, and a section that
 * changes answer with the calendar is a section no fixture can pin. `CLOCK` is
 * overridden in `tests/boot.ts` and the ageing buckets are then fixed.
 */
@Injectable()
export class FinanceService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(CLOCK) private readonly now: () => Date,
  ) {}

  /**
   * `revenue/bills`: the invoices, newest month first.
   *
   * Every status, including `draft` and `void`, because this section answers "what
   * did we bill" and a withdrawn bill is a fact about what was billed. Whether any
   * of it is still owed is `revenue/receivables`' question, and it is asked there.
   */
  async readBills(): Promise<FinanceEnvelope<Bill[], BillStatus>> {
    const rows = await this.db
      .select()
      .from(financeBills)
      .orderBy(desc(financeBills.month), desc(financeBills.dueAt), asc(financeBills.id));

    return envelope(rows.map(billRecord), billStatusEnum.enumValues as BillStatus[]);
  }

  /**
   * `revenue/receivables`: what is owed, per bill, aged against the injected clock.
   *
   * ## The three subtractions, and which of them is a sum
   *
   * A bill's net total is what was invoiced. Two things reduce what is owed since:
   * credits taken off after issue, and money settled. Both are read from the database
   * in the same query rather than in a JavaScript second pass, so a credit written a
   * millisecond after this query cannot appear in one figure and not the other.
   *
   * `draft` is excluded and so are `paid` and `void`: a month that has not been issued
   * is not yet money anybody owes, and a paid or withdrawn one is not owed at all.
   * Leaving them in would make this section a second bills list with an extra column,
   * and the reader would have to know the rule to subtract the rows that do not apply.
   *
   * ## Why the ageing is computed here and not in SQL
   *
   * Because `daysBetween` is a JavaScript function over two `Date`s, and doing it in
   * SQL would mean a second implementation of the same truncation rule in a dialect
   * where it is harder to read. One rule, one place, and the injected clock reaches
   * it.
   */
  async readReceivables(): Promise<FinanceEnvelope<Receivable[], ReceivableBucket>> {
    const now = this.now();
    const rows = await this.db
      .select({
        bill: financeBills,
        // A `text` cast and a `Number` below, for the reason the settlement runs do
        // it: `sum()` over a `bigint` column is a bigint, and a bigint from PGlite
        // arrives as a string. Reading it as text and converting once means the
        // column is an integer in minor units by the time it is a `Money`.
        creditsMinor: sql<string>`sum(${financeCredits.amountMinor})::text`,
      })
      .from(financeBills)
      .leftJoin(financeCredits, eq(financeCredits.billId, financeBills.id))
      .where(inArray(financeBills.status, [...RECEIVABLE_STATUSES]))
      .groupBy(financeBills.id)
      .orderBy(asc(financeBills.dueAt), asc(financeBills.id));

    const receivables: Receivable[] = rows.map(({ bill, creditsMinor }) => {
      const currency = bill.currency as Currency;
      const netTotal = bill.commitmentChargeMinor + bill.overageChargeMinor + bill.slaCreditMinor;
      const credited = Number(creditsMinor);
      const settled = bill.settledMinor;
      const daysOverdue = daysBetween(bill.dueAt, now);

      return {
        billId: bill.id,
        ispId: bill.ispId,
        ispName: bill.ispName,
        month: bill.month,
        currency,
        total: money(netTotal, currency),
        settled: money(settled, currency),
        outstanding: money(netTotal + credited - settled, currency),
        dueAt: bill.dueAt.toISOString(),
        daysOverdue,
        bucket: receivableBucket(daysOverdue),
      };
    });

    return envelope(receivables, [...RECEIVABLE_BUCKETS]);
  }

  /**
   * `revenue/credits`: credits taken off a bill, newest first.
   *
   * A join rather than a select, because `finance_credits` carries none of the
   * columns a reader needs — `ispId`, `month` and `currency` are the bill's, so the
   * query is what supplies them.
   */
  async readCredits(): Promise<FinanceEnvelope<CreditRecord[], CreditBasis>> {
    const rows = await this.db
      .select({ credit: financeCredits, bill: financeBills })
      .from(financeCredits)
      .innerJoin(financeBills, eq(financeBills.id, financeCredits.billId))
      .orderBy(desc(financeCredits.recordedAt), asc(financeCredits.id));

    const credits = rows.map(({ credit, bill }) => creditRecord({ ...bill, ...credit }));

    return envelope(credits, creditBasisEnum.enumValues as CreditBasis[]);
  }

  /**
   * `settlement/payouts`: obligations and how far through the rail each one is.
   *
   * Separate from `settlement/movements`, which reports money that moved: this table
   * holds what is owed and a lifecycle, so a payout that failed is still owed and a
   * payout that completed three weeks ago is a closed obligation rather than a
   * settlement line to be re-derived. The two sections disagree on purpose when a
   * payout is in flight, and each of them is right about its own question.
   */
  async readPayouts(): Promise<FinanceEnvelope<PayoutRecord[], PayoutStatus>> {
    const rows = await this.db
      .select()
      .from(financePayouts)
      .orderBy(desc(financePayouts.occurredAt), asc(financePayouts.id));

    return envelope(rows.map(payoutRecord), financePayoutStatusEnum.enumValues as PayoutStatus[]);
  }

  /**
   * `ledger/ledger`: the chart, with each account's balance on its normal side.
   *
   * ## Why the whole chart is read even though the accounts are the rows
   *
   * Because a balance is not a property of an account — it is a property of an
   * account and every entry posted to it. Reading the accounts and the entries in
   * three queries and folding them in `@hewa/ledger-accounting` is also what lets a
   * posting to an account outside the chart fail loudly rather than being dropped
   * from a balance.
   *
   * Sorted by the chart's own order rather than by name, so the assets an operator
   * reconciles first are the ones at the top.
   */
  async readLedger(): Promise<FinanceEnvelope<LedgerSection, AccountType>> {
    const [accountRows, entryRows, legRows] = await Promise.all([
      this.db
        .select()
        .from(financeLedgerAccounts)
        .orderBy(asc(financeLedgerAccounts.type), asc(financeLedgerAccounts.name)),
      this.db
        .select()
        .from(financeLedgerEntries)
        .orderBy(desc(financeLedgerEntries.occurredAt), asc(financeLedgerEntries.id)),
      this.db.select().from(financeLedgerPostings),
    ]);

    const accounts = accountRecords(accountRows);
    const currencyByAccount = new Map(accounts.map((row) => [row.id, row.currency]));
    const entries = journalEntries(entryRows, legRows, (accountId) => {
      const currency = currencyByAccount.get(accountId);
      if (currency === undefined) {
        throw new Error(`Posting references an account outside the chart: ${accountId}`);
      }
      return currency;
    });

    return envelope(
      {
        accounts: ledgerAccountRecords(accounts, entries),
        // The entries the balances above were folded from, as rows: they are already
        // read, and an operator posting one wants to see what it did to the accounts
        // beside it. `nameByAccount` is the chart's own names, so a posting reads as
        // the account an operator recognises rather than as an id they have to look up.
        entries: ledgerEntryRecords(
          entries,
          entryRows,
          new Map(accounts.map((row) => [row.id, row.name])),
        ),
      },
      accountTypeEnum.enumValues as AccountType[],
    );
  }

  /**
   * `proof/attestations`: one row per city and day, each carrying its month's verdict.
   *
   * Ordered by month and day rather than by `publishedAt`, because the section's
   * question is "which months are short a day" and a list sorted by signing time puts
   * the days of one month at opposite ends of the table. Within a month, the later
   * day first — the most recent publication is what an operator is usually looking for.
   *
   * The verdict is computed across all rows before it is attached, so every day of a
   * month agrees with every other day of it. A per-row verdict would be a guess: day
   * 31 of a 31-day month cannot know whether day 1 arrived.
   */
  async readAttestations(): Promise<FinanceEnvelope<AttestationRecord[], AttestationVerdict>> {
    const rows = await this.db
      .select()
      .from(financeAttestations)
      .orderBy(
        desc(financeAttestations.month),
        desc(financeAttestations.day),
        asc(financeAttestations.city),
      );

    const attestations = attestationsWithVerdicts(rows.map(attestationRecord));

    return envelope(attestations, [...ATTESTATION_VERDICTS]);
  }
}
