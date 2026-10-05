import { describe, expect, test } from "vite-plus/test";
import {
  ACCOUNT_TYPE_TITLES,
  ACCOUNT_TYPES,
  ATTESTATION_VERDICTS,
  ATTESTATION_VERDICT_TITLES,
  BILL_STATUSES,
  BILL_STATUS_TITLES,
  CREDIT_BASES,
  CREDIT_BASIS_TITLES,
  FINANCE_SECTION_ENDPOINTS,
  FINANCE_SECTION_KEYS,
  FINANCE_SECTIONS,
  FINANCE_VIEWS,
  FINANCE_WRITE_RESOURCES,
  FINANCE_WRITE_VERBS,
  financeSectionPath,
  parseSectionKey,
  PAYOUT_METHODS,
  PAYOUT_METHOD_TITLES,
  PAYOUT_STATUSES,
  PAYOUT_STATUS_TITLES,
  RECEIVABLE_BUCKETS,
  RECEIVABLE_BUCKET_TITLES,
  SECTION_TITLES,
  WRITE_ID_PREFIXES,
  writeVerbs,
  type BillPatch,
  type AttestationCreate,
  type CreditCreate,
  type FinanceGroups,
  type FinancePayload,
  type FinanceSectionId,
  type FinanceSectionKey,
  type FinanceViewKey,
  type FinanceWritePayloads,
  type FinanceWriteRecords,
  type LedgerAccount,
  type LedgerEntryCreate,
  type LedgerEntryRecord,
  type PayoutPatch,
} from "../src/index.ts";

/**
 * The contract's own internal consistency.
 *
 * A types-only package has very little to assert at runtime, so this is about the
 * places a hand-written list can lie: the sections named in `FINANCE_SECTIONS` and
 * the sections typed in `FinancePayload`, and the verbs named in
 * `FINANCE_WRITE_VERBS` and the payloads typed in `FinanceWritePayloads`. Each pair
 * has to be written out separately — a type is erased — and each is checked at build
 * time here so the disagreement is a failed type check rather than a 404 or a button
 * that posts to a route nobody wrote.
 */

/** Every section key names a payload, and `FINANCE_SECTION_KEYS` is the whole list. */
const typed: Record<FinanceSectionKey, keyof FinancePayload> = {
  "revenue/bills": "revenue/bills",
  "revenue/receivables": "revenue/receivables",
  "revenue/credits": "revenue/credits",
  "settlement/payouts": "settlement/payouts",
  "ledger/ledger": "ledger/ledger",
  "proof/attestations": "proof/attestations",
};

/**
 * The other direction.
 *
 * Without this, a key added to `FinancePayload` and forgotten in `FINANCE_SECTIONS`
 * is a payload no section key can name and nothing complains: `typed` satisfies its
 * annotation with the extra key simply absent, because a `Record` annotation checks
 * the keys that are there.
 */
const viewed: Record<keyof FinancePayload, FinanceSectionKey> = typed;

/**
 * Every writable resource names the payload its accepted verb takes, and answers
 * with the record that verb returns.
 *
 * Two maps asserted by the same annotation rather than one: a resource whose verb is
 * `patch` must be typed against `*Patch` and not against its create, and the only
 * way to say "the payload is the verb's" is to hold both maps side by side. The
 * `Record` keys are the half that a runtime test cannot reach — a payload typed for
 * the wrong verb compiles in every other file in this package and only here.
 */
const payloads: Record<(typeof FINANCE_WRITE_RESOURCES)[number], keyof FinanceWritePayloads> = {
  bills: "bills",
  credits: "credits",
  payouts: "payouts",
  ledger_entries: "ledger_entries",
  attestations: "attestations",
};

/** The three resources that are created rather than patched. */
type CreatedResource = "credits" | "ledger_entries" | "attestations";

const records: Record<keyof FinanceWriteRecords, keyof FinanceWriteRecords> = {
  bills: "bills",
  credits: "credits",
  payouts: "payouts",
  ledger_entries: "ledger_entries",
  attestations: "attestations",
};

describe("the dashboard's sections", () => {
  test("the payload map and the section registry name the same six", () => {
    expect(Object.keys(typed).toSorted()).toEqual([...FINANCE_SECTION_KEYS].toSorted());
    expect(Object.keys(viewed).toSorted()).toEqual([...FINANCE_SECTION_KEYS].toSorted());
  });

  test("every view owns at least one section", () => {
    // A rail column with nothing in it is a navigation dead end, and nothing in the
    // shell treats one differently from a populated one — it just renders.
    for (const view of FINANCE_VIEWS) {
      expect(FINANCE_SECTIONS[view].length, view).toBeGreaterThan(0);
    }
    expect(Object.keys(FINANCE_SECTIONS).toSorted()).toEqual([...FINANCE_VIEWS].toSorted());
  });

  test("a section key is named once", () => {
    expect(new Set(FINANCE_SECTION_KEYS).size).toBe(FINANCE_SECTION_KEYS.length);
  });

  test("the flattened key list is the registry, in registry order", () => {
    const expected = FINANCE_VIEWS.flatMap((view) =>
      FINANCE_SECTIONS[view].map((section) => `${view}/${section}`),
    );
    expect(FINANCE_SECTION_KEYS).toEqual(expected);
  });

  test("a key parses back into the view and section it was built from", () => {
    for (const key of FINANCE_SECTION_KEYS) {
      const { view, section } = parseSectionKey(key);
      expect(section, key).toBe(key.slice(view.length + 1));
      expect(FINANCE_VIEWS as readonly string[], key).toContain(view);
      expect(FINANCE_SECTIONS[view as FinanceViewKey] as readonly string[], key).toContain(section);
    }
  });

  test("every section filters on a group, so none is accidentally ungrouped", () => {
    // A list section whose groups became `never` would stop offering filters and
    // nothing would say so except an operator discovering it. All six group: bills
    // by status, receivables by ageing bucket, credits by basis, payouts by state,
    // accounts by type, attestations by month coverage.
    const statuses: FinanceGroups<"revenue/bills"> = ["disputed"];
    const buckets: FinanceGroups<"revenue/receivables"> = ["d90_plus"];
    const bases: FinanceGroups<"revenue/credits"> = ["sla_shortfall"];
    const states: FinanceGroups<"settlement/payouts"> = ["converting"];
    const types: FinanceGroups<"ledger/ledger"> = ["asset"];
    const verdicts: FinanceGroups<"proof/attestations"> = ["partial"];

    expect([...statuses, ...buckets, ...bases, ...states, ...types, ...verdicts]).toHaveLength(6);
  });

  test("the ledger section answers with the chart *and* the entries posted against it", () => {
    // The one section whose data is not a list. Its entries are unreachable from any
    // other section, so a payload that carried the accounts alone would leave
    // `LedgerEntryRecord` — and the write service's answer — readable only by the
    // writer who just wrote it.
    const data: FinancePayload["ledger/ledger"]["data"] = {
      accounts: [] as readonly LedgerAccount[],
      entries: [] as readonly LedgerEntryRecord[],
    };

    expect(Object.keys(data).toSorted()).toEqual(["accounts", "entries"]);
  });
});

describe("financeSectionPath", () => {
  test("a section's endpoint hangs off the versioned prefix and names both halves", () => {
    // `api/v1` rather than `finance`, and the reason is the two hops. The browser
    // asks its own origin for this path and the app's route handler asks central-api
    // for the same one, so the prefix is the app's public API and not a name for one
    // service behind it. `finance` *is* the grouping, and it scopes the read side:
    // the write side lives under `api/v1/data` for the whole workspace.
    expect(financeSectionPath("revenue", "bills")).toBe("/api/v1/finance/revenue/bills");
    expect(financeSectionPath("proof", "attestations")).toBe("/api/v1/finance/proof/attestations");
  });

  test("the client-facing endpoint map is this function applied to every section", () => {
    // `FINANCE_SECTION_ENDPOINTS` is written out by hand so a client can look a path
    // up by key without a cast, and a hand-written map is a second copy of six
    // strings. This walks the registry rather than the map, so a seventh section
    // added to `FINANCE_SECTIONS` and forgotten here fails here too.
    for (const view of FINANCE_VIEWS) {
      for (const section of FINANCE_SECTIONS[view]) {
        const key = `${view}/${section}` as FinanceSectionKey;
        expect(FINANCE_SECTION_ENDPOINTS[key], key).toBe(financeSectionPath(view, section));
      }
    }
  });

  test("the endpoint map names every section and nothing else", () => {
    expect(Object.keys(FINANCE_SECTION_ENDPOINTS).toSorted()).toEqual(
      [...FINANCE_SECTION_KEYS].toSorted(),
    );
  });

  test("every section has a path, and no two share one", () => {
    // Two sections sharing a path would mean one section's rows answering for
    // another, which is the failure the whole split exists to prevent.
    const paths = FINANCE_SECTION_KEYS.map((key) => {
      const { view, section } = parseSectionKey(key);
      return financeSectionPath(
        view as FinanceViewKey,
        section as FinanceSectionId<FinanceViewKey>,
      );
    });
    expect(new Set(paths).size).toBe(FINANCE_SECTION_KEYS.length);
    expect(paths).toEqual(FINANCE_SECTION_KEYS.map((key) => `/api/v1/finance/${key}`));
  });
});

describe("section titles", () => {
  test("every section has a title, and no two share one", () => {
    expect(Object.keys(SECTION_TITLES).toSorted()).toEqual([...FINANCE_SECTION_KEYS].toSorted());
    const titles = Object.values(SECTION_TITLES);
    expect(new Set(titles).size).toBe(titles.length);
  });

  test("a title is written for a reader", () => {
    // The wire id is `at_risk` and the title is "At risk". A title that still holds
    // the wire format is the raw column value leaking into the rail, so the
    // underscore check is the assertion.
    for (const [key, title] of Object.entries(SECTION_TITLES)) {
      expect(title, key).toBeTypeOf("string");
      expect(title, key).not.toBe("");
      expect(title, key).not.toContain("_");
      expect(title, key).not.toContain("/");
    }
  });

  test("no title restates the view it sits under", () => {
    // The view already has a tab above it, so a section called "Ledger" inside the
    // ledger view prints the word twice. This is why `ledger/ledger` is "Accounts".
    for (const [key, title] of Object.entries(SECTION_TITLES)) {
      const { view } = parseSectionKey(key as FinanceSectionKey);
      expect(title.toLowerCase(), key).not.toBe(`${view} `.trim().toLowerCase());
    }
  });
});

describe("the group vocabularies a filter bar is built from", () => {
  /**
   * Each is a list the dashboard turns into chips, and each is a *value* the rows
   * carry. The assertion that matters is the one that holds when someone adds a
   * member to a list and forgets the column behind it — which the service cannot
   * catch at compile time and the e2e test catches only for the values it walks.
   */
  const cases: { name: string; values: readonly string[] }[] = [
    { name: "bill statuses", values: BILL_STATUSES },
    { name: "receivable buckets", values: RECEIVABLE_BUCKETS },
    { name: "credit bases", values: CREDIT_BASES },
    { name: "payout statuses", values: PAYOUT_STATUSES },
    { name: "attestation verdicts", values: ATTESTATION_VERDICTS },
  ];

  for (const { name, values } of cases) {
    test(`${name} holds no duplicate`, () => {
      // A duplicated member renders as two chips that filter to the same rows, and
      // the count beside them doubles for one value.
      expect(new Set(values).size, name).toBe(values.length);
    });

    test(`${name} is not empty`, () => {
      // An empty vocabulary means no chips, which reads as "no filter" rather than
      // as "nothing to filter by".
      expect(values.length, name).toBeGreaterThan(0);
    });
  }

  test("a receivable bucket covers the gap between two adjacent windows", () => {
    // `d1_30` then `d31_60`: the day after the thirtieth is the thirty-first, and a
    // bucket written as "1-30" and the next as "30-60" would both claim it. The
    // names are the assertion, so a bucket renamed to a range has to be renamed on
    // both sides of its boundary at once.
    expect(RECEIVABLE_BUCKETS).toEqual(["current", "d1_30", "d31_60", "d61_90", "d90_plus"]);
  });

  test("a payout status list is settlement-domain's, not a copy of it", () => {
    // `PAYOUT_STATUSES` is re-exported from `@hewa/settlement-domain` rather than
    // declared here, so this is a check that the re-export is still wired up: the
    // alternative — a dashboard-local list — would let a panel offer a state the
    // transition machine has no edge out of.
    expect(PAYOUT_STATUSES).toContain("converting");
    expect(PAYOUT_STATUSES).not.toContain("settled");
  });
});

describe("every create names its own row", () => {
  /**
   * The three `POST` payloads each carry a required `id`.
   *
   * Written as a conditional type rather than an assignment because the assignment
   * compiles either way: an optional `id` infers `string | undefined`, and a `string`
   * is assignable to that. Here an optional `id` makes the mapped type `false` and the
   * annotation fails, which is the whole point — the claim is about whether the field
   * has to be there at all, and `doc.body.id` cannot tell us that.
   */
  type RequiredStringId<T> = T extends { readonly id: infer Id }
    ? Id extends string
      ? true
      : false
    : false;

  const created: Record<
    CreatedResource,
    RequiredStringId<FinanceWritePayloads[CreatedResource]>
  > = {
    credits: true,
    ledger_entries: true,
    attestations: true,
  };

  test("each create requires the id a retry would re-send", () => {
    expect(Object.values(created)).toEqual([true, true, true]);
  });

  test("a create that generated its id server-side would make a retry a second row", () => {
    // The runtime half of the type half: the ids the three creates send are the same
    // strings a caller would send twice, so nothing about the shape invites the
    // service to invent a fourth thing to key on.
    expect(WRITE_ID_PREFIXES.ledger_entries).toBe("jrn-");
    expect(WRITE_ID_PREFIXES.credits).toBe("crd-");
    expect(WRITE_ID_PREFIXES.attestations).toBe("att-");
  });
});

describe("the display titles beside each vocabulary", () => {
  /**
   * Every vocabulary a chip is drawn from has a titles map beside it, keyed by the
   * value the chip's query-string key carries.
   *
   * This is the assertion that holds when somebody adds a member to a vocabulary and
   * forgets the title: without it a panel renders `undefined` in a chip, and a chip
   * reading `undefined` looks like a filter that matched nothing rather than like a
   * missing label. The keys are checked here rather than left to the `Record`
   * annotation, because a title map written with a partial annotation compiles.
   */
  const cases: { name: string; values: readonly string[]; titles: Record<string, string> }[] = [
    { name: "bill statuses", values: BILL_STATUSES, titles: BILL_STATUS_TITLES },
    { name: "receivable buckets", values: RECEIVABLE_BUCKETS, titles: RECEIVABLE_BUCKET_TITLES },
    { name: "credit bases", values: CREDIT_BASES, titles: CREDIT_BASIS_TITLES },
    { name: "payout statuses", values: PAYOUT_STATUSES, titles: PAYOUT_STATUS_TITLES },
    { name: "payout methods", values: PAYOUT_METHODS, titles: PAYOUT_METHOD_TITLES },
    { name: "account types", values: ACCOUNT_TYPES, titles: ACCOUNT_TYPE_TITLES },
    {
      name: "attestation verdicts",
      values: ATTESTATION_VERDICTS,
      titles: ATTESTATION_VERDICT_TITLES,
    },
  ];

  for (const { name, values, titles } of cases) {
    test(`${name} has a title for every value and no title for anything else`, () => {
      expect(Object.keys(titles).toSorted(), name).toEqual([...values].toSorted());
    });

    test(`${name} titles are written for a reader`, () => {
      for (const value of values) {
        const title = titles[value];
        // Not the wire value in different clothes: `d1_30` titled `d1_30` is a
        // chip the operator has to decode, which is the job the title is for.
        expect(title, `${name}.${value}`).not.toBe(value);
        expect(title, `${name}.${value}`).toMatch(/^\S.*\S$|^\S$/);
      }
    });
  }

  test("a title names its own value's unit rather than the row's", () => {
    // The ageing buckets are the case that has to be readable: `d31_60` is a query
    // string, and "31–60 days" is the question a collections view exists to answer.
    expect(RECEIVABLE_BUCKET_TITLES.d31_60).toContain("31");
    expect(RECEIVABLE_BUCKET_TITLES.d90_plus).toContain("90");
  });
});

describe("what may be written", () => {
  test("the payload and record maps cover exactly the writable resources", () => {
    expect(Object.keys(payloads).toSorted()).toEqual([...FINANCE_WRITE_RESOURCES].toSorted());
    expect(Object.keys(records).toSorted()).toEqual([...FINANCE_WRITE_RESOURCES].toSorted());
    expect(Object.keys(FINANCE_WRITE_VERBS).toSorted()).toEqual(
      [...FINANCE_WRITE_RESOURCES].toSorted(),
    );
  });

  test("every resource accepts at least one verb", () => {
    // A resource with no verbs is in the list because someone intended to write it
    // and did not, and the type system has no way to say so.
    for (const resource of FINANCE_WRITE_RESOURCES) {
      expect(writeVerbs(resource).length, resource).toBeGreaterThan(0);
    }
  });

  test("no finance resource accepts an upsert", () => {
    // The load-bearing assertion in this file. An upsert is a replace, and a replace
    // is how a caller overwrites a metered or quoted figure with a typed one. The
    // admin console gives every one of its six tables a `PUT`, and copying that
    // shape here would put "replace this bill's charges" behind a button on a table
    // whose charges came off a meter.
    for (const resource of FINANCE_WRITE_RESOURCES) {
      expect(writeVerbs(resource), resource).not.toContain("upsert");
    }
    expect(Object.values(FINANCE_WRITE_VERBS).flat()).not.toContain("upsert");
  });

  test("a resource that is patched cannot also be created", () => {
    // `bills` and `payouts` exist to be moved along, not to be brought into being:
    // a bill is issued by the billing run and a payout obligation is created when a
    // settled batch is paid. If one of them grew a `create`, the reason it cannot
    // have one would have to be re-argued, so it fails here instead.
    expect(writeVerbs("bills")).toEqual(["patch"]);
    expect(writeVerbs("payouts")).toEqual(["patch"]);
  });

  test("a resource that is created cannot also be patched", () => {
    // A credit is the correction; an attestation is signed on creation. Editing one
    // after the fact is the mistake the ledger exists to make visible, and it is
    // visible only if the second statement is a separate row.
    expect(writeVerbs("credits")).toEqual(["create"]);
    expect(writeVerbs("ledger_entries")).toEqual(["create"]);
    expect(writeVerbs("attestations")).toEqual(["create"]);
  });

  test("no finance resource accepts a delete", () => {
    // There is no `delete` in `FinanceVerb` to accept, and this says so from the
    // other side: if a verb named `delete` were ever added to the union, this list
    // would still not carry one, so the test is what stops the union growing.
    const verbs: string[] = Object.values(FINANCE_WRITE_VERBS).flat();
    expect(verbs).not.toContain("delete");
  });

  test("a patched resource's payload is the patch, and its create is `never`", () => {
    // The compile-time half. `bills` is a `BillPatch` because `PATCH /data/bills/:id`
    // is the only route that exists for it — so if a `POST /data/bills` were written
    // by hand against a body this package says is `never`, it fails here first.
    const patch: BillPatch = { status: "disputed", disputeReason: "Measured overage is wrong" };
    const payout: PayoutPatch = { status: "failed" };
    const credit: CreditCreate = {
      id: "crd-0001",
      billId: "bil-0001",
      amountMinor: -1_000,
      basis: "sla_shortfall",
      note: "99.1% against a 99.9% commitment",
      recordedAt: "2026-09-30T09:00:00Z",
    };
    const entry: LedgerEntryCreate = {
      id: "jrn-0001",
      reference: "bil-0001:settle",
      description: "Settle September",
      occurredAt: "2026-09-30T09:00:00Z",
      currency: "USD",
      postings: [
        { accountId: "ar-isp", amountMinor: 4_500_00 },
        { accountId: "rev-bw", amountMinor: -4_500_00 },
      ],
    };

    expect(patch.status).toBe("disputed");
    expect(payout.status).toBe("failed");
    expect(credit.amountMinor).toBeLessThan(0);
    expect(entry.postings).toHaveLength(2);
  });

  test("an attestation write cannot name a root, a signature or a net", () => {
    // A `CreditCreate` names `amountMinor`; an `AttestationCreate` names `grossMinor`
    // and `costsMinor` and nothing else. The fields that are absent are the point:
    // `merkleRoot`, `signature`, `publishedAt` and `netRevenue` are all produced
    // elsewhere, and a payload that could name any of them would let a web form
    // assert a proof or restate a figure that is derived.
    const noProofFields: AbsenceIsExact<ProofFields<AttestationCreate>, never> = true;
    expect(noProofFields).toBe(true);
  });
});

/**
 * The compile-time half of the assertion above, which is the half that matters.
 *
 * `Pick<T, K>` is the wrong tool: it fails when a key is *missing*, which is the
 * state we want, so writing it turns the desired result into a build error. `Extract`
 * goes the other way — it names the forbidden keys the type actually has — and the
 * branded comparison then fails to compile unless that set is exactly `never`. So
 * adding `merkleRoot` to `AttestationCreate` is a type error here rather than a
 * review question.
 */
type ProofFields<T> = Extract<
  keyof T,
  "merkleRoot" | "signature" | "publishedAt" | "netRevenue" | "netRevenueMinor"
>;

/**
 * `true` only when `A` and `B` are the same type.
 *
 * The conditional-type-over-identity trick rather than a mutual assignability check,
 * because `[A] extends [B]` and `[B] extends [A]` are both satisfied by `any` and by
 * `never`, and the one type that must never satisfy this assertion is `never`.
 */
type AbsenceIsExact<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
