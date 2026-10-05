import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import type { INestApplication } from "@nestjs/common";
import {
  FINANCE_WRITE_RESOURCES,
  FINANCE_WRITE_VERBS,
  type AttestationCreate,
  type AttestationRecord,
  type Bill,
  type CreditCreate,
  type CreditRecord,
  type FinancePayload,
  type FinanceVerb,
  type FinanceWriteResource,
  type LedgerEntryCreate,
  type LedgerEntryRecord,
  type PayoutRecord,
} from "@hewa/financial-dashboard-types";
import { ResponseCode } from "@hewa/response-codes";

import {
  bootCentralApi,
  TEST_NOW,
  TEST_TOKEN,
  TEST_WRITE_TOKEN,
  UNAUTHORIZED_BODY,
  withTokens,
  WRITE_UNAUTHORIZED_BODY,
  writing,
} from "./boot.js";
import { SERVICE_TOKEN_HEADER } from "../src/api-v1/service-token.guard.js";
import { WRITE_TOKEN_HEADER } from "../src/api-v1/write-token.guard.js";

/**
 * The five finance writes over real HTTP: `/api/v1/data/{resource}`.
 *
 * ## Why this suite is not a table like the console's
 *
 * Because the console's six resources are four verbs over the same shape of row — a
 * list of fields to write and a record to answer with — so one fixture per resource
 * can drive thirty identical checks. Finance's five are one verb each, and the *rule*
 * is the interesting part of every one of them: which transitions a bill may make, that
 * a credit's sign is load-bearing for receivables, that a payout's reason travels with
 * its status, that a journal entry must foot, and that an attestation's verdict is
 * counted rather than sent. A fixture table would have four columns of `create` and
 * `patch` and push all of that into a per-resource footnote, which is where it goes to
 * be read once.
 *
 * ## What is asserted about a refusal
 *
 * The status *and* the response code, and for the cross-field rules also the field. A
 * 422 from the Zod pipe and a 422 from a `CHECK` constraint are the same status with
 * different causes, and the console suite's `refuses` exists for exactly that reason.
 * The field matters most here: a body that marks a bill `disputed` with no reason has to
 * come back naming `disputeReason`, because the column check catches it too and answers
 * with a SQLSTATE rather than with a field an operator can fill in.
 *
 * ## And the verbs that are not there
 *
 * `FINANCE_WRITE_VERBS` is walked in both directions: the five routes that must answer,
 * and the fifteen that must not be routed at all. The second half is the more important
 * one — `POST /bills/:id` and `DELETE /ledger_entries/jrn-0001` are 404s, and that is
 * the assertion which stops somebody adding a convenience create for invoices.
 */

/** The error envelope the filter emits, as far as these assertions read it. */
interface Serialized {
  readonly responseCode: string;
  readonly message: string;
  readonly details?: { issues?: { path?: string }[] } & Record<string, unknown>;
}

describe("/api/v1/data/finance writes", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await bootCentralApi();
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  /** One write, with both tokens and a JSON body. */
  function send(resource: FinanceWriteResource, method: string, body: unknown, id?: string) {
    const path = `${baseUrl}/api/v1/data/${resource}${id === undefined ? "" : `/${id}`}`;
    return writing(path, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  const patch = (resource: FinanceWriteResource, id: string, body: unknown) =>
    send(resource, "PATCH", body, id);
  const post = (resource: FinanceWriteResource, body: unknown) => send(resource, "POST", body);

  /** A body as an object, for the field-level assertions. */
  async function json<T>(response: Response): Promise<T> {
    return (await response.json()) as T;
  }

  /**
   * A refusal, asserted on the status and the code the caller switches on.
   *
   * It returns the body because a `Response` can only be read once: a test that asserts
   * `refuses(...)` and then wants to check what the message said has to have been handed
   * the text, and reading `response.text()` again throws rather than answering.
   */
  async function refuses(
    response: Response,
    code: ResponseCode,
    status: number,
  ): Promise<Serialized> {
    const text = await response.text();
    expect(response.status, `body was ${text}`).toBe(status);
    const body = JSON.parse(text) as Serialized;
    expect(body.responseCode, `body was ${text}`).toBe(code);
    return body;
  }

  /** The first field a 422 names, which is how a cross-field refusal says what to fix. */
  function refusedField(body: Serialized): string {
    return body.details?.issues?.[0]?.path ?? "";
  }

  /** One account's balance, as the `ledger/ledger` section reports it. */
  async function balanceOf(accountId: string): Promise<number> {
    // `data.accounts`, not `data`: the section answers with the chart *and* the journal,
    // so a reader that reached for the list would be reading `undefined`. Typed against
    // the contract's own payload, which is what makes that a compile error here rather
    // than a `cannot read find of undefined` in a write test.
    const ledger = await json<FinancePayload["ledger/ledger"]>(
      await writing(`${baseUrl}/api/v1/finance/ledger/ledger`),
    );
    const account = ledger.data.accounts.find((row) => row.id === accountId);
    if (account === undefined) {
      throw new Error(`No such account in the chart: ${accountId}`);
    }
    return account.balance.amountMinor;
  }

  describe("the routes the contract declares, and only those", () => {
    test("each declared verb has a route", async () => {
      // Driven from the contract rather than written out, so a sixth resource with no
      // controller is a failing test rather than a dashboard button posting to a 404.
      expect(Object.keys(FINANCE_WRITE_VERBS).length).toBe(FINANCE_WRITE_RESOURCES.length);

      const declared: [FinanceWriteResource, FinanceVerb][] = [];
      for (const resource of FINANCE_WRITE_RESOURCES) {
        for (const verb of FINANCE_WRITE_VERBS[resource]) {
          declared.push([resource, verb]);
        }
      }

      for (const [resource, verb] of declared) {
        // A body no schema accepts, so a 422 is the pipe refusing it — which is the
        // evidence the route exists. A well-formed body would answer 404 for a missing
        // id, which cannot tell a routed resource from an unrouted one.
        const response =
          verb === "patch"
            ? await patch(resource, "no-such-row", { notAField: true })
            : await post(resource, { notAField: true });
        expect(response.status, `${resource} ${verb} is routed`).toBe(422);
      }
    });

    test("no finance resource accepts a verb the contract does not declare", async () => {
      // `POST` is `create` and `PUT` is `upsert` in the contract's own names, so the
      // mapping is written out rather than lowercased: "post" is not a `FinanceVerb`, so
      // `verbs.includes("post")` is false for every resource and every create route
      // would be counted as unrouted.
      const asVerb: Record<string, FinanceVerb | null> = {
        POST: "create",
        PUT: "upsert",
        PATCH: "patch",
        DELETE: null,
      };

      let refused = 0;
      for (const resource of FINANCE_WRITE_RESOURCES) {
        const verbs: readonly FinanceVerb[] = FINANCE_WRITE_VERBS[resource];
        for (const [method, verb] of Object.entries(asVerb)) {
          if (verb !== null && verbs.includes(verb)) {
            continue;
          }
          // `upsert` is in `FinanceVerb` for the app's editor registry's sake and no
          // finance resource takes one, so it is refused for all of them; `DELETE` is
          // not a `FinanceVerb` at all, refused for the same reason.
          const response = await send(resource, method, {}, "no-such-row");
          expect(response.status, `${method} ${resource} is not routed`).toBe(404);
          refused += 1;
        }
      }
      // Three per resource: no `DELETE` anywhere, no `PUT` anywhere, and whichever of
      // `POST`/`PATCH` the resource does not take.
      expect(refused).toBe(FINANCE_WRITE_RESOURCES.length * 3);
    });
  });

  describe("PATCH /api/v1/data/bills/:id", () => {
    test("a legal transition writes the status and leaves the charges alone", async () => {
      // bil-0011 is the seeded draft, so issuing it is the one move in the seed that is
      // legal and has nothing metered behind it yet.
      const response = await patch("bills", "bil-0011", { status: "issued" });
      expect(response.status).toBe(200);

      const bill = await json<Bill>(response);
      expect(bill.status).toBe("issued");
      // The three charge columns are the bill's own arithmetic, and a patch that touched
      // them would break it — so the response is checked against itself.
      expect(bill.breakdown.netTotal.amountMinor).toBe(
        bill.breakdown.commitmentCharge.amountMinor +
          bill.breakdown.overageCharge.amountMinor +
          bill.breakdown.slaCredit.amountMinor,
      );
    });

    test("an illegal transition is a 422 naming both ends of it", async () => {
      // bil-0001 is paid, and paid is terminal: a bill that can be un-paid is one whose
      // ageing can be rewritten.
      const body = await refuses(
        await patch("bills", "bil-0001", { status: "draft" }),
        ResponseCode.ValidationFailed,
        422,
      );
      expect(body.message).toContain("transition");
      expect(body.details).toMatchObject({ from: "paid", to: "draft" });
    });

    test("a disputed bill with no reason is a 422 naming disputeReason", async () => {
      const body = await refuses(
        await patch("bills", "bil-0006", { status: "disputed" }),
        ResponseCode.ValidationFailed,
        422,
      );
      expect(refusedField(body)).toBe("disputeReason");
    });

    test("a disputed bill with a reason writes both columns together", async () => {
      const response = await patch("bills", "bil-0007", {
        status: "disputed",
        disputeReason:
          "February overage disputed: the meter reading is above the independent probe.",
      });
      expect(response.status).toBe(200);
      const bill = await json<Bill>(response);
      expect(bill.status).toBe("disputed");
      expect(bill.disputeReason).toContain("independent probe");
    });

    test("a reason on a bill that is not disputed is a 422", async () => {
      const body = await refuses(
        await patch("bills", "bil-0008", {
          status: "issued",
          disputeReason: "not a dispute",
        }),
        ResponseCode.ValidationFailed,
        422,
      );
      expect(refusedField(body)).toBe("disputeReason");
    });

    test("resolving a dispute clears the reason in the same body", async () => {
      // The other half of the rule above, and the reason `null` is not a second thing
      // to say: `finance_bills_dispute_reason_iff_disputed` says a bill that is not
      // `disputed` carries no reason, so the move out of `disputed` is also the move
      // that drops it. A schema that refused the `null` would leave the dispute above
      // with no way to resolve it.
      const response = await patch("bills", "bil-0007", {
        status: "issued",
        disputeReason: null,
      });
      expect(response.status).toBe(200);

      const bill = await json<Bill>(response);
      expect(bill.status).toBe("issued");
      expect(bill.disputeReason).toBeNull();
    });

    test("clearing a reason while the bill is still disputed is a 422", async () => {
      // Same row, disputed again by this body — and the reason is dropped without the
      // status moving. The column would refuse it as `23514`; here it names the field.
      const disputed = await patch("bills", "bil-0007", {
        status: "disputed",
        disputeReason: "Reopened: the independent probe's reading came back a month late.",
      });
      expect(disputed.status).toBe(200);

      const body = await refuses(
        await patch("bills", "bil-0007", { disputeReason: null }),
        ResponseCode.ValidationFailed,
        422,
      );
      expect(body.message).toContain("needs a reason");
      expect(body.details).toMatchObject({ disputeReason: expect.any(String) });
    });

    test("an empty patch is a read, not a write", async () => {
      // The console's suite asserts this too and it is worth having here: a body naming
      // nothing must not write `undefined` over a `notNull` column, which fails
      // differently per driver.
      const response = await patch("bills", "bil-0010", {});
      expect(response.status).toBe(200);
      expect((await json<Bill>(response)).status).toBe("issued");
    });

    test("a patch cannot set a charge", async () => {
      // The reason bills have no PUT: a metered figure is not a field an operator types,
      // and a body that could carry it would re-price a month with nothing in the record
      // saying so.
      await refuses(
        await patch("bills", "bil-0010", { commitmentChargeMinor: 1 }),
        ResponseCode.ValidationFailed,
        422,
      );
    });

    test("a status the table does not have is a 422", async () => {
      await refuses(
        await patch("bills", "bil-0010", { status: "written-off" }),
        ResponseCode.ValidationFailed,
        422,
      );
    });

    test("an unknown id is a 404", async () => {
      await refuses(
        await patch("bills", "bil-nope", { status: "issued" }),
        ResponseCode.NotFound,
        404,
      );
    });

    test("a refused patch left the row as it was", async () => {
      const refused = await patch("bills", "bil-0002", { status: "draft" });
      expect(refused.status).toBe(422);

      const bills = await json<{ data: Bill[] }>(
        await writing(`${baseUrl}/api/v1/finance/revenue/bills`),
      );
      expect(bills.data.find((bill) => bill.id === "bil-0002")?.status).toBe("paid");
    });
  });

  describe("POST /api/v1/data/credits", () => {
    const body: CreditCreate = {
      id: "crd-e2e-1",
      billId: "bil-0010",
      amountMinor: -1_500_00,
      basis: "goodwill",
      note: "Two days of outage during the February maintenance window, credited at the operator's discretion.",
      recordedAt: "2026-02-04T10:00:00.000Z",
    };

    test("creates a credit and answers 201 with the bill's own figures", async () => {
      const response = await post("credits", body);
      expect(response.status).toBe(201);

      const credit = await json<CreditRecord>(response);
      // The row stores no ispId, ispName, month or currency — they are the bill's — so
      // the answer is only correct if the service joined, and a credit carrying its own
      // copy could name one ISP while pointing at another's bill.
      expect(credit.billId).toBe("bil-0010");
      expect(credit.ispName).toBe("Vodacom Tanzania");
      expect(credit.month).toBe("2026-02");
      expect(credit.currency).toBe("USD");
      expect(credit.amount.amountMinor).toBe(-1_500_00);
      expect(credit.basis).toBe("goodwill");
    });

    test("a positive credit is a 422, and the sign is the point", async () => {
      const body422 = await refuses(
        await post("credits", { ...body, id: "crd-e2e-2", amountMinor: 1_500_00 }),
        ResponseCode.ValidationFailed,
        422,
      );
      expect(refusedField(body422)).toBe("amountMinor");
    });

    test("a credit against a bill that does not exist is a 404", async () => {
      await refuses(
        await post("credits", { ...body, id: "crd-e2e-3", billId: "bil-nope" }),
        ResponseCode.NotFound,
        404,
      );
    });

    test("the same credit twice is a 409", async () => {
      await refuses(await post("credits", body), ResponseCode.Conflict, 409);
    });

    test("a credit with an unknown key is a 422", async () => {
      await refuses(
        await post("credits", { ...body, id: "crd-e2e-4", surchargeMinor: 1 }),
        ResponseCode.ValidationFailed,
        422,
      );
    });

    test("the credit is taken off the receivable it names", async () => {
      // The reason a credit is a row against a bill rather than a column on the bill:
      // one query answers "what is owed on this bill" and the reduction is a line
      // somebody can read. Asserted against the receivable's own columns rather than a
      // figure pinned twice, so the arithmetic is what is being checked.
      const receivables = await json<{
        data: {
          billId: string;
          total: { amountMinor: number };
          settled: { amountMinor: number };
          outstanding: { amountMinor: number };
        }[];
      }>(await writing(`${baseUrl}/api/v1/finance/revenue/receivables`));
      const receivable = receivables.data.find((row) => row.billId === body.billId);
      expect(receivable).toBeDefined();
      expect(receivable?.outstanding.amountMinor).toBe(
        (receivable?.total.amountMinor ?? 0) +
          body.amountMinor -
          (receivable?.settled.amountMinor ?? 0),
      );
    });
  });

  describe("PATCH /api/v1/data/payouts/:id", () => {
    test("a legal transition moves the payout and keeps a reason off it", async () => {
      // pay-0004 is pending, so pending → converting is the rail's own first move.
      const response = await patch("payouts", "pay-0004", { status: "converting" });
      expect(response.status).toBe(200);
      const payout = await json<PayoutRecord>(response);
      expect(payout.status).toBe("converting");
      expect(payout.failureReason).toBeNull();
    });

    test("an illegal transition is a 422 naming both ends of it", async () => {
      // pay-0001 is completed, and the rail has nowhere to go from there.
      const body422 = await refuses(
        await patch("payouts", "pay-0001", { status: "sending" }),
        ResponseCode.ValidationFailed,
        422,
      );
      expect(body422.message).toContain("transition");
      expect(body422.details).toMatchObject({ from: "completed", to: "sending" });
    });

    test("a failure with no reason is a 422 naming failureReason", async () => {
      const body422 = await refuses(
        await patch("payouts", "pay-0005", { status: "failed" }),
        ResponseCode.ValidationFailed,
        422,
      );
      expect(refusedField(body422)).toBe("failureReason");
    });

    test("a failure with a reason writes both columns", async () => {
      const response = await patch("payouts", "pay-0005", {
        status: "failed",
        failureReason: "The beneficiary bank rejected the transfer: invalid account number.",
      });
      expect(response.status).toBe(200);
      const payout = await json<PayoutRecord>(response);
      expect(payout.status).toBe("failed");
      expect(payout.failureReason).toContain("invalid account number");
    });

    test("a retry out of failed clears the old reason", async () => {
      // pay-0006 is failed in the seed and failed → pending is the domain's retry. The
      // reason described the attempt that was abandoned, so carrying it into the retry
      // would leave a live payout explaining a failure that has not happened yet.
      const response = await patch("payouts", "pay-0006", {
        status: "pending",
        failureReason: null,
      });
      expect(response.status).toBe(200);
      const payout = await json<PayoutRecord>(response);
      expect(payout.status).toBe("pending");
      expect(payout.failureReason).toBeNull();
    });

    test("a reason on a payout that is not failed is a 422", async () => {
      const body422 = await refuses(
        await patch("payouts", "pay-0003", { status: "sending", failureReason: "not a failure" }),
        ResponseCode.ValidationFailed,
        422,
      );
      expect(refusedField(body422)).toBe("failureReason");
    });

    test("a status the rail does not have is a 422", async () => {
      await refuses(
        await patch("payouts", "pay-0003", { status: "refunded" }),
        ResponseCode.ValidationFailed,
        422,
      );
    });

    test("an unknown id is a 404", async () => {
      await refuses(
        await patch("payouts", "pay-nope", { status: "converting" }),
        ResponseCode.NotFound,
        404,
      );
    });
  });

  describe("POST /api/v1/data/ledger_entries", () => {
    const balanced: LedgerEntryCreate = {
      id: "jrn-e2e-1",
      reference: "2026-03:operating-costs",
      description: "March network operating costs accrued from the February run.",
      occurredAt: "2026-03-01T00:00:00.000Z",
      currency: "USD",
      postings: [
        { accountId: "acc-4000", amountMinor: 45_000_00 },
        { accountId: "acc-1001", amountMinor: -45_000_00 },
      ],
    };

    test("posts an entry and answers 201 with its legs and totals", async () => {
      const response = await post("ledger_entries", balanced);
      expect(response.status).toBe(201);

      const entry = await json<LedgerEntryRecord>(response);
      expect(entry.reference).toBe("2026-03:operating-costs");
      expect(entry.balanced).toBe(true);
      // The debits and the balanced flag come from one `totalsFor` call in the mapper,
      // so the flag is a comparison of the two numbers printed beside it.
      expect(entry.debits.amountMinor).toBe(45_000_00);
      expect(entry.credits.amountMinor).toBe(45_000_00);
      // The legs are resolved to names a reader sees rather than to ids they would have
      // to look up in the chart.
      expect(entry.postings.map((leg) => leg.accountName)).toEqual([
        "Network operating costs",
        "Cash at bank",
      ]);
    });

    test("legs that do not balance are a 422", async () => {
      const body422 = await refuses(
        await post("ledger_entries", {
          ...balanced,
          id: "jrn-e2e-2",
          reference: "2026-03:unbalanced",
          postings: [
            { accountId: "acc-4000", amountMinor: 45_000_00 },
            { accountId: "acc-1001", amountMinor: -44_000_00 },
          ],
        }),
        ResponseCode.ValidationFailed,
        422,
      );
      // The domain's own message rather than a wrapper's: `journalEntry` is what
      // refused, so the difference it measured is what the caller reads.
      expect(body422.message).toContain("does not balance");
      // 4,500,000 − 4,400,000 minor units, as the domain measured it: the refusal
      // carries the difference rather than a "nearly balanced".
      expect(body422.details).toMatchObject({ differenceMinor: 100_000 });
    });

    test("one leg is a 422: a journal entry needs two", async () => {
      await refuses(
        await post("ledger_entries", {
          ...balanced,
          id: "jrn-e2e-3",
          reference: "2026-03:single-leg",
          postings: [{ accountId: "acc-4000", amountMinor: 45_000_00 }],
        }),
        ResponseCode.ValidationFailed,
        422,
      );
    });

    test("a leg naming an account outside the chart is a 422", async () => {
      const body422 = await refuses(
        await post("ledger_entries", {
          ...balanced,
          id: "jrn-e2e-4",
          reference: "2026-03:unknown-account",
          postings: [
            { accountId: "acc-4000", amountMinor: 45_000_00 },
            { accountId: "acc-9999", amountMinor: -45_000_00 },
          ],
        }),
        ResponseCode.ValidationFailed,
        422,
      );
      expect(body422.details).toMatchObject({ accountId: "acc-9999" });
    });

    test("a leg into an account in another currency is a 422", async () => {
      // Every seeded account is USD, so this is the wrong-currency form of the mistake:
      // an entry declared in a currency the chart does not hold. Without the check the
      // entry would foot to zero on both sides and report itself balanced.
      const body422 = await refuses(
        await post("ledger_entries", {
          ...balanced,
          id: "jrn-e2e-5",
          reference: "2026-03:wrong-currency",
          currency: "KES",
        }),
        ResponseCode.ValidationFailed,
        422,
      );
      expect(body422.message).toContain("another currency");
      expect(body422.details).toMatchObject({ entryCurrency: "KES", accountCurrency: "USD" });
    });

    test("the same reference twice is a 409, so a retry cannot post twice", async () => {
      await refuses(await post("ledger_entries", balanced), ResponseCode.Conflict, 409);
    });

    test("the balance moved by exactly the amount posted", async () => {
      const before = await balanceOf("acc-4000");
      const posted = await post("ledger_entries", {
        ...balanced,
        id: "jrn-e2e-6",
        reference: "2026-03:maintenance",
        description: "March maintenance accrual.",
        postings: [
          { accountId: "acc-4000", amountMinor: 12_500_00 },
          { accountId: "acc-1001", amountMinor: -12_500_00 },
        ],
      });
      expect(posted.status).toBe(201);
      // An expense's normal side is a debit, so a positive posting raises its balance —
      // the sign convention read through the domain rather than restated here.
      expect(await balanceOf("acc-4000")).toBe(before + 12_500_00);
    });
  });

  describe("POST /api/v1/data/attestations", () => {
    const body: AttestationCreate = {
      id: "att-e2e-1",
      city: "Mombasa",
      month: "2026-03",
      day: 30,
      currency: "USD",
      grossMinor: 900_000_00,
      costsMinor: 310_000_00,
    };

    test("publishes a day and stamps the server's clock", async () => {
      const response = await post("attestations", body);
      expect(response.status).toBe(201);

      const attestation = await json<AttestationRecord>(response);
      // The body carries no timestamp, so the only way a `publishedAt` can be backdated
      // is by moving the clock — which the suite overrides to `TEST_NOW`.
      expect(attestation.publishedAt).toBe(TEST_NOW.toISOString());
      // `netRevenue` is not sent either; it is the subtraction, done in the mapper.
      expect(attestation.netRevenue.amountMinor).toBe(590_000_00);
    });

    test("the verdict is counted over the table rather than read off the body", async () => {
      // A second city, so this does not repost an id the test above published: the
      // unique key is `(city, month, day)` and a 409 would say so instead of testing the
      // verdict.
      const day30 = { ...body, id: "att-e2e-5", city: "Kisumu", day: 30 };
      const first = await json<AttestationRecord>(await post("attestations", day30));
      // March has 31 days and Kisumu has published one of them, so the answer is
      // `partial`. A rule reading the body would have called the 30th of a 31-day month
      // complete if it confused "the last day I sent" with "the whole month", and a rule
      // reading only the row would have had no month length to compare the count with.
      expect(first.verdict).toBe("partial");

      const second = await post("attestations", { ...day30, id: "att-e2e-6", day: 31 });
      expect(second.status).toBe(201);
      // Two days of thirty-one is still partial, and the count behind it went up by one
      // — which is the whole difference between counting the table and trusting the
      // payload.
      expect((await json<AttestationRecord>(second)).verdict).toBe("partial");
    });

    test("the same city day twice is a 409", async () => {
      await refuses(await post("attestations", body), ResponseCode.Conflict, 409);
    });

    test("a month that is not YYYY-MM is a 422", async () => {
      await refuses(
        await post("attestations", { ...body, id: "att-e2e-3", month: "March" }),
        ResponseCode.ValidationFailed,
        422,
      );
    });

    test("a day outside 1 to 31 is a 422", async () => {
      await refuses(
        await post("attestations", { ...body, id: "att-e2e-4", day: 32 }),
        ResponseCode.ValidationFailed,
        422,
      );
    });

    test("a published day appears in the section with the same verdict", async () => {
      const attestations = await json<{ data: AttestationRecord[] }>(
        await writing(`${baseUrl}/api/v1/finance/proof/attestations`),
      );
      const published = attestations.data.find((row) => row.id === "att-e2e-1");
      expect(published?.verdict).toBe("partial");
      // The section's net figure and the `POST`'s are one subtraction, so a write
      // response and the row it becomes cannot drift.
      expect(published?.netRevenue.amountMinor).toBe(590_000_00);
    });
  });

  describe("the write guards", () => {
    test("every finance route is refused with no token at all", async () => {
      const routes = [
        ["bills/bil-0010", "PATCH"],
        ["credits", "POST"],
        ["payouts/pay-0003", "PATCH"],
        ["ledger_entries", "POST"],
        ["attestations", "POST"],
      ] as const;

      for (const [route, method] of routes) {
        const response = await fetch(`${baseUrl}/api/v1/data/${route}`, {
          method,
          headers: { "content-type": "application/json" },
          body: "{}",
        });
        expect(response.status, `${method} ${route} is guarded`).toBe(401);
        expect(await response.text()).toMatch(UNAUTHORIZED_BODY);
      }
    });

    test("a write with only the service token is refused, which is the point of two", async () => {
      const response = await withTokens(
        `${baseUrl}/api/v1/data/credits`,
        { [SERVICE_TOKEN_HEADER]: TEST_TOKEN },
        { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
      );
      expect(response.status).toBe(401);
      expect(await response.text()).toMatch(WRITE_UNAUTHORIZED_BODY);
    });

    test("a write with only the write token is refused too", async () => {
      const response = await withTokens(
        `${baseUrl}/api/v1/data/bills/bil-0010`,
        { [WRITE_TOKEN_HEADER]: TEST_WRITE_TOKEN },
        { method: "PATCH", headers: { "content-type": "application/json" }, body: "{}" },
      );
      expect(response.status).toBe(401);
      expect(await response.text()).toMatch(UNAUTHORIZED_BODY);
    });

    test("a wrong write token is refused", async () => {
      const response = await withTokens(
        `${baseUrl}/api/v1/data/bills/bil-0010`,
        { [SERVICE_TOKEN_HEADER]: TEST_TOKEN, [WRITE_TOKEN_HEADER]: `${TEST_WRITE_TOKEN}-wrong` },
        { method: "PATCH", headers: { "content-type": "application/json" }, body: "{}" },
      );
      expect(response.status).toBe(401);
    });
  });
});
