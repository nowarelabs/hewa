import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import type { INestApplication } from "@nestjs/common";
import {
  CONSOLE_WRITE_RESOURCES,
  DELETABLE_WRITE_RESOURCES,
  type ConsoleWriteResource,
} from "@hewa/console-types";
import { ResponseCode } from "@hewa/response-codes";

import {
  bootCentralApi,
  TEST_TOKEN,
  TEST_WRITE_TOKEN,
  UNAVAILABLE_BODY,
  UNAUTHORIZED_BODY,
  withTokens,
  WRITE_UNAUTHORIZED_BODY,
  WRITE_UNAVAILABLE_BODY,
  writing,
} from "./boot.js";
import { SERVICE_TOKEN_HEADER } from "../src/api-v1/service-token.guard.js";
import { WRITE_TOKEN_HEADER } from "../src/api-v1/write-token.guard.js";

/**
 * The write surface over real HTTP: `/api/v1/data/{resource}`.
 *
 * ## Why the verbs are driven from a table
 *
 * Six resources × five verbs is thirty checks written out longhand, and thirty is
 * where a test file stops being read and starts being maintained. So each resource
 * contributes one fixture — a body to write, the record that body must come back as,
 * and one field to change — and the suite drives the same checks over all six. A
 * verb implemented on five resources and forgotten on the sixth fails here for the
 * sixth, which is the only thing the repetition was buying.
 *
 * `CONSOLE_WRITE_RESOURCES` is the list from the contract and the table is checked
 * against it: a resource added there with no fixture is a failing test rather than a
 * quietly untested endpoint. The alternative — naming the six in this file — is a
 * second place to forget one.
 *
 * ## Why the expected record is not the body
 *
 * Money travels as two columns on the way in and as one `Money` on the way out,
 * because a panel draws `unitPrice` and never `priceMinor` beside a `currency` it
 * has to remember to pair it with. So each fixture carries both, and the assertion
 * that a created record matches `record` rather than `body` is the statement that a
 * write answers with the thing the read path would have said. A write that returned
 * its own request payload would pass every status assertion here and give the console
 * a second shape for the same row.
 *
 * ## Why HTTP and not the service
 *
 * Status codes are part of the contract and exist only above the controller: `201`
 * versus `200` on an upsert is decided by `@Post` versus `@Put` being in the right
 * place, `409` and `422` are the error filter's translation of a SQLSTATE, and `422`
 * is also the pipe. Calling `OrdersWriteService.create` would prove the insert
 * worked and nothing about any of those.
 */
interface Fixture {
  /** The path segment, from `CONSOLE_WRITE_RESOURCES`. */
  readonly resource: ConsoleWriteResource;
  /** What a caller writes: the columns, with no id — the resource owns that. */
  readonly body: Record<string, unknown>;
  /** What the service must answer with, minus the id. */
  readonly record: Record<string, unknown>;
  /** A well-formed id belonging to no row, for the 404s. */
  readonly absentId: string;
  /** Write columns to change, and the record fields that must follow. */
  readonly patch: Record<string, unknown>;
  readonly patched: Record<string, unknown>;
  /** The field the patch names, and the whole body to send in its place. */
  readonly replaced: Record<string, unknown>;
}

/**
 * A node from the committed seed, for the monitor fixture's foreign key.
 *
 * Written out rather than fetched, because the fixtures are built while this module
 * is being evaluated and the application has not booted yet. `seed.ts` is committed
 * and its ids are not generated, so a drift here arrives as a 422 on the foreign key
 * naming the missing node — which says what changed.
 */
const SEEDED_NODE_ID = "nod-nbo-01";

const NODE_BODY = {
  name: "WR Amsterdam IX",
  kind: "ixp",
  provider: "Northwind",
  city: "Amsterdam",
  country: "NL",
  lat: 52.3676,
  lng: 4.9041,
  capacityGbps: 400,
  utilisationBps: 8_750,
  status: "operational",
  observedAt: "2026-03-01T03:00:00.000Z",
};

const ORDER_BODY = {
  pool: "nairobi_ixp",
  side: "bid",
  provider: "Northwind",
  committedGbps: 40,
  burstGbps: 60,
  priceMinor: 540_000,
  currency: "USD",
  submittedAt: "2026-03-01T02:00:00.000Z",
};

const SPOT_BODY = {
  pool: "nairobi_ixp",
  priceMinor: 512_000,
  currency: "USD",
  observedAt: "2026-03-01T04:00:00.000Z",
};

const SETTLEMENT_BODY = {
  batch: "run-2026-03-01",
  kind: "clearing",
  status: "completed",
  counterparty: "Sahara ISP",
  amountMinor: 1_250_000,
  feeMinor: 12_500,
  currency: "USD",
  occurredAt: "2026-03-01T01:30:00.000Z",
  // Nullable, but stated. A replace that left this one out would be writing a null
  // nobody asked for, so the field is required on a write and only the value is free.
  failureReason: null,
};

const ALERT_BODY = {
  title: "Latency up 45 ms on the primary path",
  description: "Failover engaged at 03:12 UTC.",
  category: "outage",
  severity: "high",
  entityId: SEEDED_NODE_ID,
  entityLabel: "Equinix Nairobi",
  provider: "Equinix",
  city: "Nairobi",
  lat: -1.3192,
  lng: 36.9278,
  impactedGbps: 40,
  affectedSlas: 3,
  automatedAction: null,
  raisedAt: "2026-03-01T03:12:00.000Z",
};

const MONITOR_BODY = {
  account: "Sahara ISP",
  nodeId: SEEDED_NODE_ID,
  nodeName: "Equinix Nairobi",
  provider: "Equinix",
  sla: { targetBps: 9_995, actualBps: 9_975, creditNumerator: 1, creditDenominator: 20 },
  packetLossPpm: 120,
  latencyP95Ms: 12,
  measuredAt: "2026-03-01T03:00:00.000Z",
};

/**
 * A commitment far enough below its target to be a breach.
 *
 * `AT_RISK_BPS` is a whole percentage point, so a shortfall of 95 basis points is
 * still `at_risk` and a test asserting `breached` from it would be asserting a
 * rounding. 195 is unambiguously past the line.
 */
const MONITOR_SLA_BREACHED = {
  targetBps: 9_995,
  actualBps: 9_800,
  creditNumerator: 1,
  creditDenominator: 20,
};

function fixtures(): Fixture[] {
  return [
    {
      resource: "orders",
      body: ORDER_BODY,
      record: {
        pool: ORDER_BODY.pool,
        side: ORDER_BODY.side,
        provider: ORDER_BODY.provider,
        committedGbps: ORDER_BODY.committedGbps,
        burstGbps: ORDER_BODY.burstGbps,
        unitPrice: { amountMinor: ORDER_BODY.priceMinor, currency: ORDER_BODY.currency },
        submittedAt: ORDER_BODY.submittedAt,
      },
      absentId: `${UNUSED}-ord-absent`,
      patch: { priceMinor: 545_000 },
      patched: { unitPrice: { amountMinor: 545_000, currency: "USD" } },
      // Every column the body can carry, so a replace that merged would fail here:
      // the test differs from the create in all of them, not in the one it picked.
      replaced: { ...ORDER_BODY, provider: "Equinix", side: "offer", priceMinor: 546_000 },
    },
    {
      resource: "spots",
      body: SPOT_BODY,
      // The instant is drawn per test so two spots cannot share a natural key, so the
      // record asserts the shape of the field rather than one test's value.
      record: { ...SPOT_BODY, observedAt: expect.any(String) as unknown as string },
      absentId: "999999",
      patch: { priceMinor: 508_000 },
      patched: { priceMinor: 508_000 },
      replaced: { ...SPOT_BODY, priceMinor: 509_000 },
    },
    {
      resource: "nodes",
      body: NODE_BODY,
      record: { ...NODE_BODY },
      absentId: `${UNUSED}-nod-absent`,
      patch: { status: "degraded" },
      patched: { status: "degraded" },
      replaced: { ...NODE_BODY, name: "WR Amsterdam IX (spare)", status: "degraded" },
    },
    {
      resource: "settlements",
      body: SETTLEMENT_BODY,
      record: {
        batch: SETTLEMENT_BODY.batch,
        kind: SETTLEMENT_BODY.kind,
        status: SETTLEMENT_BODY.status,
        counterparty: SETTLEMENT_BODY.counterparty,
        amount: { amountMinor: SETTLEMENT_BODY.amountMinor, currency: SETTLEMENT_BODY.currency },
        fee: { amountMinor: SETTLEMENT_BODY.feeMinor, currency: SETTLEMENT_BODY.currency },
        occurredAt: SETTLEMENT_BODY.occurredAt,
        failureReason: null,
      },
      absentId: `${UNUSED}-set-absent`,
      patch: { status: "failed", failureReason: "the counterparty's file was rejected" },
      patched: { status: "failed", failureReason: "the counterparty's file was rejected" },
      replaced: { ...SETTLEMENT_BODY, status: "failed", feeMinor: 0 },
    },
    {
      resource: "alerts",
      body: ALERT_BODY,
      record: { ...ALERT_BODY },
      absentId: `${UNUSED}-alt-absent`,
      patch: { severity: "critical" },
      patched: { severity: "critical" },
      replaced: { ...ALERT_BODY, severity: "critical", impactedGbps: 120, affectedSlas: 7 },
    },
    {
      resource: "monitors",
      body: MONITOR_BODY,
      record: { ...MONITOR_BODY, state: "at_risk" },
      absentId: `${UNUSED}-mon-absent`,
      patch: { sla: MONITOR_SLA_BREACHED },
      // The state is the service's to decide, so a patch that changes the SLA changes
      // a field the body never mentions.
      patched: { sla: MONITOR_SLA_BREACHED, state: "breached" },
      replaced: { ...MONITOR_BODY, packetLossPpm: 900, sla: MONITOR_SLA_BREACHED },
    },
  ];
}

let app: INestApplication;
let baseUrl: string;

/** Prefix for every id this file writes, so one cannot be mistaken for a seed row. */
const UNUSED = "wrt";

/**
 * A fresh id per test, so two tests in one database never collide.
 *
 * A shared id per resource is the obvious thing to write and it is wrong the moment
 * there is more than one test creating: the second one gets a 409 from its own setup
 * and the failure reads as a contract problem rather than a fixture problem.
 */
let created = 0;

function nextId(resource: ConsoleWriteResource): string {
  created += 1;
  return `${UNUSED}-${resource}-${created}`;
}

/**
 * A spot body with an instant no other test has used.
 *
 * `(pool, observedAt)` is a spot's natural key, so the fresh id a spot cannot take
 * is its observation time. Built from a `Date` rather than interpolated into a
 * string, because a counter that outgrows the field it is written into produces a
 * body that is not an instant — and the service refuses it as a 422, which reads as
 * a contract bug rather than as a fixture that ran out of room.
 */
let observed = 0;

function nextSpotBody(): Record<string, unknown> {
  observed += 1;
  return {
    ...SPOT_BODY,
    observedAt: new Date(Date.UTC(2026, 3, 1) + observed * 60_000).toISOString(),
  };
}

/** A body and id nothing else in this file has written, for the resource's own test. */
function fresh(fixture: Fixture): {
  resource: ConsoleWriteResource;
  body: Record<string, unknown>;
  id: string | null;
} {
  return fixture.resource === "spots"
    ? { resource: fixture.resource, body: nextSpotBody(), id: null }
    : { resource: fixture.resource, body: fixture.body, id: nextId(fixture.resource) };
}

/** The id as an expectation field, for the resource that takes one. */
const asId = (id: string | null): Record<string, unknown> => (id === null ? {} : { id });

/** The path for a resource's collection and for one record within it. */
const collection = (resource: ConsoleWriteResource): string => `${baseUrl}/api/v1/data/${resource}`;

/**
 * The path an upsert goes to: by id, or by natural key for a spot.
 *
 * `spots` is the only resource with a generated id, so there is nothing for a `PUT`
 * to address and the upsert happens on `(pool, observedAt)`. A branch rather than a
 * column in the table, so a second resource needing it becomes a second branch rather
 * than a second convention.
 */
const upsertPath = (resource: ConsoleWriteResource, id: string | null): string =>
  id === null ? collection(resource) : `${collection(resource)}/${id}`;

/**
 * `POST` a body, adding the id the resource takes one for.
 *
 * Five of the six resources are given their id by the caller even on create — the
 * console holds one already, and minting a second is a sort key nobody remembers. A
 * spot is the exception: its id is a generated integer, so `id` is `null` and the
 * body goes out without one.
 */
function post(resource: ConsoleWriteResource, body: unknown, id: string | null): Promise<Response> {
  return send(resource, "POST", body, id === null ? collection(resource) : undefined, id);
}

/** `PUT` a whole body, addressing by id or by natural key as the resource requires. */
function put(resource: ConsoleWriteResource, id: string | null, body: unknown): Promise<Response> {
  return send(resource, "PUT", body, upsertPath(resource, id));
}

/** `PATCH` the fields the body names. */
function patch(resource: ConsoleWriteResource, id: string, body: unknown): Promise<Response> {
  return send(resource, "PATCH", body, `${collection(resource)}/${id}`);
}

/** `GET` one record. */
function readOne(resource: ConsoleWriteResource, id: string): Promise<Response> {
  return writing(`${collection(resource)}/${id}`);
}

/** One verb, with the JSON plumbing and both tokens. */
function send(
  resource: ConsoleWriteResource,
  method: string,
  body: unknown,
  path = collection(resource),
  id: string | null = null,
): Promise<Response> {
  return writing(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(id === null ? body : { ...(body as object), id }),
  });
}

/** The body a test wants to compare against, as an object. */
async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

/**
 * The id of a created record, whether the caller supplied it or the database did.
 */
async function createdId(response: Response, requested: string | null): Promise<string> {
  const record = await json(response);
  expect(typeof record.id, `a created record carries an id, got ${JSON.stringify(record)}`).toBe(
    "string",
  );
  if (requested !== null) {
    expect(record.id).toBe(requested);
  }
  return record.id as string;
}

/**
 * A refusal, asserted on the status *and* the response code.
 *
 * Every failure in this service is a `{ code, responseCode, message }` envelope, and
 * a test asserting only `409` would pass on a 409 raised by something other than the
 * duplicate it meant. `ResponseCode` is the part a caller switches on.
 */
async function refuses(response: Response, code: ResponseCode, status: number): Promise<void> {
  const body = await response.text();
  expect(response.status, `body was ${body}`).toBe(status);
  expect((JSON.parse(body) as { responseCode: string }).responseCode, `body was ${body}`).toBe(
    code,
  );
}

describe("POST /api/v1/data/:resource", () => {
  beforeAll(async () => {
    app = await bootCentralApi();
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  test("the table covers every writable resource in the contract", () => {
    expect(
      fixtures()
        .map((fixture) => fixture.resource)
        .sort(),
    ).toEqual([...CONSOLE_WRITE_RESOURCES].sort());
  });

  for (const fixture of fixtures()) {
    const { resource, record } = fixture;

    test(`${resource}: creates a record and answers 201 with the record`, async () => {
      const { body, id } = fresh(fixture);
      const response = await post(resource, body, id);

      expect(response.status).toBe(201);
      expect(await json(response)).toMatchObject({ ...record, ...asId(id) });
    });

    test(`${resource}: a second create of the same record is a 409`, async () => {
      const first = fresh(fixture);

      expect(
        (await post(first.resource, first.body, first.id)).status,
        "the fixture's own row",
      ).toBe(201);
      await refuses(await post(first.resource, first.body, first.id), ResponseCode.Conflict, 409);
    });
  }

  test("a create with an unknown key is a 422, not a silently dropped field", async () => {
    await refuses(
      await post("nodes", { ...NODE_BODY, rackHeight: 4 }, nextId("nodes")),
      ResponseCode.ValidationFailed,
      422,
    );
  });

  test("a create with a value outside the table's vocabulary is a 422", async () => {
    await refuses(
      await post("nodes", { ...NODE_BODY, kind: "space_station" }, nextId("nodes")),
      ResponseCode.ValidationFailed,
      422,
    );
  });

  test("a create that a CHECK constraint would refuse is a 422", async () => {
    await refuses(
      await post("nodes", { ...NODE_BODY, utilisationBps: 10_001 }, nextId("nodes")),
      ResponseCode.ValidationFailed,
      422,
    );
  });

  test("a create whose money carries more precision than its currency is a 422", async () => {
    await refuses(
      await post("settlements", { ...SETTLEMENT_BODY, amountMinor: 100.5 }, nextId("settlements")),
      ResponseCode.ValidationFailed,
      422,
    );
  });

  test("a create whose burst is below its committed width is a 422", async () => {
    await refuses(
      await post("orders", { ...ORDER_BODY, burstGbps: 10 }, nextId("orders")),
      ResponseCode.ValidationFailed,
      422,
    );
  });

  test("a create whose timestamp is not an instant is a 422", async () => {
    await refuses(
      await post("orders", { ...ORDER_BODY, submittedAt: "the third of March" }, nextId("orders")),
      ResponseCode.ValidationFailed,
      422,
    );
  });

  test("a monitor's state is the service's to decide, so the body cannot set it", async () => {
    await refuses(
      await post("monitors", { ...MONITOR_BODY, state: "healthy" }, nextId("monitors")),
      ResponseCode.ValidationFailed,
      422,
    );
  });

  test("a monitor on a node that does not exist is a 422, not a 500", async () => {
    const body = await json(
      await post(
        "monitors",
        { ...MONITOR_BODY, nodeId: `${UNUSED}-nod-missing` },
        nextId("monitors"),
      ),
    );

    expect(body.code, "a foreign key is refused, not crashed on").toBe("validation_failed");
  });

  test("the market's own figures still answer after an order is written", async () => {
    const id = nextId("orders");
    expect((await post("orders", ORDER_BODY, id)).status).toBe(201);

    const book = await writing(`${baseUrl}/api/v1/market/book`);
    const payload = await json(book);

    expect(book.status).toBe(200);
    // The book is derived from the orders, so a write moves it. If it did not, the
    // figure would be a rollup that nobody's write updated.
    expect(JSON.stringify(payload)).toContain(id);
  });
});

describe("GET /api/v1/data/:resource/:id", () => {
  beforeAll(async () => {
    app = await bootCentralApi();
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  for (const fixture of fixtures()) {
    const { resource, absentId, record } = fixture;
    test(`${resource}: reads back the record it wrote`, async () => {
      const { body, id } = fresh(fixture);
      const written = await createdId(await post(resource, body, id), id);

      const response = await readOne(resource, written);

      expect(response.status).toBe(200);
      expect(await json(response)).toMatchObject({ ...record, id: written });
    });

    test(`${resource}: an id nobody wrote is a 404`, async () => {
      await refuses(await readOne(resource, absentId), ResponseCode.NotFound, 404);
    });
  }

  test("a spot is addressed by the id the database generated", async () => {
    const written = await createdId(await post("spots", SPOT_BODY, null), null);

    expect(written).toMatch(/^\d+$/);
    expect((await json(await readOne("spots", written))).observedAt).toBe(SPOT_BODY.observedAt);
  });
});

describe("PUT /api/v1/data/:resource", () => {
  beforeAll(async () => {
    app = await bootCentralApi();
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  for (const fixture of fixtures()) {
    const { resource, replaced, record } = fixture;

    test(`${resource}: writes a record that was not there, and answers 201`, async () => {
      const { body, id } = fresh(fixture);

      const response = await put(resource, id, body);

      expect(response.status).toBe(201);
      expect(await json(response)).toMatchObject({ ...record, ...asId(id) });
    });

    test(`${resource}: replaces one that was there, and answers 200`, async () => {
      const { body, id } = fresh(fixture);
      expect((await put(resource, id, body)).status).toBe(201);

      // A replace addresses the *same* record, so the spot keeps its observation time
      // and its id stays `null` — there is no id on the path for it.
      const response = await put(resource, id, {
        ...replaced,
        ...(resource === "spots" ? { observedAt: body.observedAt } : {}),
      });

      expect(response.status).toBe(200);
      expect(await json(response)).toMatchObject({
        ...record,
        ...expectedAfterReplace(resource, replaced),
        ...asId(id),
      });
    });
  }

  test("an upsert onto a natural key is 201, then 200 for the same observation", async () => {
    const spot = { resource: "spots" as const, body: nextSpotBody(), id: null };

    const first = await put("spots", null, spot.body);
    expect(first.status).toBe(201);
    const id = await createdId(first, null);

    const second = await put("spots", null, { ...spot.body, priceMinor: 511_000 });

    expect(second.status).toBe(200);
    const record = await json(second);
    expect(record.id, "the natural key kept the identity").toBe(id);
    expect(record.priceMinor).toBe(511_000);
  });

  test("a spot's create and its upsert agree on the natural key", async () => {
    const body = nextSpotBody();
    const createdRecord = await json(await post("spots", body, null));

    const upserted = await put("spots", null, body);

    expect(upserted.status).toBe(200);
    expect((await json(upserted)).id).toBe(createdRecord.id);
  });
});

describe("PATCH /api/v1/data/:resource/:id", () => {
  beforeAll(async () => {
    app = await bootCentralApi();
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  for (const fixture of fixtures()) {
    const { resource, patch: change, patched } = fixture;
    test(`${resource}: changes the fields the body names and leaves the rest alone`, async () => {
      const { body, id } = fresh(fixture);
      const written = await createdId(await post(resource, body, id), id);
      const before = await json(await readOne(resource, written));

      const response = await patch(resource, written, change);

      expect(response.status).toBe(200);
      const after = await json(response);
      expect(after).toMatchObject({ ...patched, id: written });
      // Everything the patch did not move is unchanged, which is what makes it a
      // patch: a replace would have written `undefined` over the rest of the row.
      //
      // Both `change` and `patched` are consulted because a column and the record
      // field it arrives in are not always the same name — `priceMinor` comes back as
      // `unitPrice` — and skipping only the sent column would compare the one field
      // the patch was *for* against the value it just replaced.
      for (const [key, value] of Object.entries(before)) {
        if (!(key in change) && !(key in patched) && key !== "updatedAt") {
          expect(after[key], `${resource} ${key}`).toEqual(value);
        }
      }
    });

    test(`${resource}: an empty patch is a read, not a write`, async () => {
      const { body, id } = fresh(fixture);
      const written = await createdId(await post(resource, body, id), id);

      const response = await patch(resource, written, {});

      expect(response.status).toBe(200);
      expect(await json(response)).toEqual(await json(await readOne(resource, written)));
    });
  }

  test("a patch on an id nobody wrote is a 404", async () => {
    await refuses(
      await patch("nodes", `${UNUSED}-nod-nope`, { status: "operational" }),
      ResponseCode.NotFound,
      404,
    );
  });

  test("an empty patch on an id nobody wrote is still a 404", async () => {
    await refuses(await patch("nodes", `${UNUSED}-nod-nope`, {}), ResponseCode.NotFound, 404);
  });

  test("a patch cannot write a field the resource does not have", async () => {
    const id = nextId("nodes");
    await post("nodes", NODE_BODY, id);

    await refuses(
      await patch("nodes", id, { id: "something-else" }),
      ResponseCode.ValidationFailed,
      422,
    );
  });

  test("a patch that would break a CHECK is a 422, and the record is untouched", async () => {
    const id = nextId("nodes");
    await post("nodes", NODE_BODY, id);

    await refuses(
      await patch("nodes", id, { utilisationBps: 10_001 }),
      ResponseCode.ValidationFailed,
      422,
    );
    expect((await json(await readOne("nodes", id))).utilisationBps).toBe(NODE_BODY.utilisationBps);
  });

  test("a patch whose rule needs the stored row is refused by the database", async () => {
    const id = nextId("orders");
    await post("orders", { ...ORDER_BODY, committedGbps: 40, burstGbps: 60 }, id);

    // No schema can check this one: the burst is fine beside a committed width of 1
    // and broken beside the 40 already stored, so the only thing that can answer is
    // the constraint, and the answer has to be a 422 rather than a 500.
    await refuses(await patch("orders", id, { burstGbps: 10 }), ResponseCode.ValidationFailed, 422);
  });

  test("a patch that would break a foreign key is a 422", async () => {
    const id = nextId("monitors");
    await post("monitors", MONITOR_BODY, id);

    const response = await patch("monitors", id, { nodeId: `${UNUSED}-nod-missing` });

    expect((await json(response)).code).toBe("validation_failed");
  });
});

describe("DELETE /api/v1/data/:resource/:id", () => {
  beforeAll(async () => {
    app = await bootCentralApi();
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  for (const resource of DELETABLE_WRITE_RESOURCES) {
    const body = resource === "orders" ? ORDER_BODY : NODE_BODY;

    test(`${resource}: deletes the record, and the id is a 404 after it`, async () => {
      const id = nextId(resource);
      await post(resource, body, id);

      const response = await writing(`${collection(resource)}/${id}`, { method: "DELETE" });

      expect(response.status).toBe(204);
      expect(await response.text(), "a 204 has no body").toBe("");
      await refuses(await readOne(resource, id), ResponseCode.NotFound, 404);
    });

    test(`${resource}: deleting an id nobody wrote is a 404`, async () => {
      const response = await writing(`${collection(resource)}/${nextId(resource)}`, {
        method: "DELETE",
      });

      await refuses(response, ResponseCode.NotFound, 404);
    });
  }

  test("the four resources with no delete route 404 on an id that exists", async () => {
    for (const fixture of fixtures()) {
      if ((DELETABLE_WRITE_RESOURCES as readonly string[]).includes(fixture.resource)) {
        continue;
      }
      const { body, id } = fresh(fixture);
      const written = await createdId(await post(fixture.resource, body, id), id);

      const response = await writing(`${collection(fixture.resource)}/${written}`, {
        method: "DELETE",
      });

      expect(response.status, `${fixture.resource} DELETE`).toBe(404);
      // Still there, which is the difference between "no such route" and "deleted the
      // record and then reported it missing".
      expect((await readOne(fixture.resource, written)).status).toBe(200);
    }
  });

  test("deleting a node takes its monitors with it", async () => {
    const nodeId = nextId("nodes");
    await post("nodes", NODE_BODY, nodeId);
    const monitorId = await createdId(
      await post("monitors", { ...MONITOR_BODY, nodeId }, nextId("monitors")),
      null,
    );

    const response = await writing(`${collection("nodes")}/${nodeId}`, { method: "DELETE" });
    expect(response.status).toBe(204);

    await refuses(await readOne("monitors", monitorId), ResponseCode.NotFound, 404);
  });
});

describe("one currency per table", () => {
  beforeAll(async () => {
    app = await bootCentralApi();
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  test("the seeded book is quoted in USD, so a USDC order would break every read", async () => {
    const response = await post("orders", { ...ORDER_BODY, currency: "USDC" }, nextId("orders"));

    await refuses(response, ResponseCode.ValidationFailed, 422);
  });

  test("and the same for a price history", async () => {
    await refuses(
      await post("spots", { ...SPOT_BODY, currency: "USDC" }, null),
      ResponseCode.ValidationFailed,
      422,
    );
  });

  test("a patch that changes the currency of a USD row is refused too", async () => {
    const id = nextId("orders");
    await post("orders", ORDER_BODY, id);

    await refuses(
      await patch("orders", id, { currency: "USDC" }),
      ResponseCode.ValidationFailed,
      422,
    );
  });

  test("a patch that leaves the currency alone is allowed", async () => {
    const id = nextId("orders");
    await post("orders", ORDER_BODY, id);

    const response = await patch("orders", id, { priceMinor: 543_000 });

    expect(response.status).toBe(200);
  });

  test("the book still answers after all of those refusals", async () => {
    const response = await writing(`${baseUrl}/api/v1/market/book`);
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect((payload.data as { currency: string }).currency).toBe("USD");
  });
});

describe("the write guards", () => {
  beforeAll(async () => {
    app = await bootCentralApi();
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  const denied = (): Record<string, unknown> => NODE_BODY;

  test("a write with both tokens is allowed", async () => {
    const response = await post("nodes", NODE_BODY, nextId("nodes"));

    expect(response.status).toBe(201);
  });

  test("a write with no token at all is refused", async () => {
    const id = nextId("nodes");
    const response = await fetch(collection("nodes"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...denied(), id }),
    });

    expect(response.status).toBe(401);
    expect(await response.text()).toMatch(UNAUTHORIZED_BODY);
  });

  test("a write with only the read token is refused, which is the point of two", async () => {
    const id = nextId("nodes");
    const response = await withTokens(
      collection("nodes"),
      { [SERVICE_TOKEN_HEADER]: TEST_TOKEN },
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...denied(), id }),
      },
    );

    expect(response.status).toBe(401);
    // The read token was accepted and the *write* one is missing, so the message has
    // to name the write token. A caller reading "your service token is wrong" would go
    // looking for the wrong secret.
    expect(await response.text()).toMatch(WRITE_UNAUTHORIZED_BODY);
  });

  test("a write with only the write token is refused too", async () => {
    const id = nextId("nodes");
    const response = await withTokens(
      collection("nodes"),
      { [WRITE_TOKEN_HEADER]: TEST_WRITE_TOKEN },
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...denied(), id }),
      },
    );

    expect(response.status).toBe(401);
  });

  test("a write with the wrong write token is refused", async () => {
    const response = await withTokens(
      collection("nodes"),
      { [SERVICE_TOKEN_HEADER]: TEST_TOKEN, [WRITE_TOKEN_HEADER]: `${TEST_WRITE_TOKEN}-x` },
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(NODE_BODY),
      },
    );

    expect(response.status).toBe(401);
  });

  test("a write token is not a read token: the read route still refuses it", async () => {
    const response = await withTokens(`${baseUrl}/api/v1/infrastructure/nodes`, {
      [WRITE_TOKEN_HEADER]: TEST_WRITE_TOKEN,
    });

    expect(response.status).toBe(401);
  });

  test("every verb is behind the guards, not only the create", async () => {
    const id = nextId("nodes");
    await post("nodes", NODE_BODY, id);
    const json = { headers: { "content-type": "application/json" } };

    for (const init of [
      { method: "GET" },
      { method: "PUT", ...json, body: JSON.stringify(NODE_BODY) },
      { method: "PATCH", ...json, body: JSON.stringify({ status: "operational" }) },
      { method: "DELETE" },
    ]) {
      const response = await fetch(`${collection("nodes")}/${id}`, init as RequestInit);

      expect(response.status, `${init.method} is guarded`).toBe(401);
    }
  });

  test("none of the refused requests wrote anything", async () => {
    const id = nextId("nodes");

    for (const tokens of [
      {},
      { [SERVICE_TOKEN_HEADER]: TEST_TOKEN },
      { [WRITE_TOKEN_HEADER]: TEST_WRITE_TOKEN },
    ]) {
      const response = await withTokens(collection("nodes"), tokens, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...denied(), id }),
      });
      expect(response.status).toBe(401);
    }

    await refuses(await readOne("nodes", id), ResponseCode.NotFound, 404);
  });
});

describe("a service configured with no write token", () => {
  let readOnly: INestApplication;

  beforeAll(async () => {
    readOnly = await bootCentralApi({ writeToken: null });
  });

  afterAll(async () => {
    await readOnly.close();
  });

  test("a read still works, so a read-only deployment is not a broken one", async () => {
    const response = await withTokens(`${await readOnly.getUrl()}/api/v1/infrastructure/nodes`, {
      [SERVICE_TOKEN_HEADER]: TEST_TOKEN,
    });

    expect(response.status).toBe(200);
  });

  test("a write is a 503 naming the variable, not a 401 blaming the caller", async () => {
    const url = `${await readOnly.getUrl()}/api/v1/data/nodes`;
    const response = await withTokens(
      url,
      { [SERVICE_TOKEN_HEADER]: TEST_TOKEN, [WRITE_TOKEN_HEADER]: TEST_WRITE_TOKEN },
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(NODE_BODY),
      },
    );

    const body = await response.text();
    expect(response.status).toBe(503);
    expect(body).toMatch(WRITE_UNAVAILABLE_BODY);
    expect(body).not.toMatch(UNAVAILABLE_BODY);
  });
});

/**
 * What a replace must have changed, per resource.
 *
 * Separate from the fixture's `replaced` body because two of the six resources carry
 * a column the service owns — the monitor's `state` — and a replace that names it is
 * a 422. The record fields below are what the console ends up drawing.
 */
function expectedAfterReplace(
  resource: ConsoleWriteResource,
  replaced: Record<string, unknown>,
): Record<string, unknown> {
  switch (resource) {
    case "orders":
      return {
        provider: replaced.provider,
        side: replaced.side,
        unitPrice: { amountMinor: replaced.priceMinor, currency: replaced.currency },
      };
    case "spots":
      return { priceMinor: replaced.priceMinor };
    case "nodes":
      return { name: replaced.name, status: replaced.status };
    case "settlements":
      return {
        status: replaced.status,
        fee: { amountMinor: replaced.feeMinor, currency: replaced.currency },
      };
    case "alerts":
      return {
        severity: replaced.severity,
        impactedGbps: replaced.impactedGbps,
        affectedSlas: replaced.affectedSlas,
      };
    case "monitors":
      // The state is listed because the commitment moved, not because the body named
      // a state: the record has to follow the SLA rather than keep the old answer.
      return {
        packetLossPpm: replaced.packetLossPpm,
        sla: replaced.sla,
        state: "breached",
      };
  }
}
