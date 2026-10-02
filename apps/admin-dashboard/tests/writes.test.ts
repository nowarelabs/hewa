import { readdirSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import {
  ALERT_CATEGORIES,
  ALERT_SEVERITIES,
  CONSOLE_WRITE_RESOURCES,
  DELETABLE_WRITE_RESOURCES,
  MARKET_POOLS,
  MARKET_SIDES,
  NODE_KINDS,
  NODE_STATUSES,
  SETTLEMENT_KINDS,
  WRITE_ID_PREFIXES,
  type ConsoleWriteResource,
} from "@hewa/console-types";
import { CURRENCIES, TRANSACTION_STATUSES } from "@hewa/marketplace-types";
import { ResponseCode } from "@hewa/response-codes";

import { ALERT_FIELDS } from "../src/app/panels/alerts";
import { NODE_FIELDS } from "../src/app/panels/infrastructure";
import { ORDER_FIELDS, SPOT_FIELDS } from "../src/app/panels/market";
import { SETTLEMENT_FIELDS } from "../src/app/panels/settlement";
import { MONITOR_FIELDS } from "../src/app/panels/slas";
import { writeResource } from "../src/app/mutations/_transport";

/**
 * The write side, from the panel's point of view.
 *
 * Three things can be wrong here and none of them show up in a screenshot: a field
 * whose name is not a column, a form that offers a vocabulary the contract does not
 * have, and a transport that turns a refusal into a success. The first two are
 * asserted here against the fixtures the rest of the app already reads from — a real
 * record of each resource — because a field name that does not resolve in a record is
 * a field the service will never accept, and the compiler cannot see it through the
 * `asWrite` assertion.
 *
 * Nothing here asserts that a *value* is valid. That is central-api's answer to give,
 * and the panel shows what it says; re-deciding it in a browser would be a second
 * implementation of `write-schemas.ts`.
 */

const MUTATIONS_DIRECTORY = new URL("../src/app/mutations/", import.meta.url);
const ROUTES_DIRECTORY = new URL("../src/app/api/v1/data/", import.meta.url);

/** Each resource's field list, and a real record of it, from the app's fixtures. */
const FORMS: readonly {
  readonly resource: ConsoleWriteResource;
  readonly fields: readonly { readonly name: string; readonly kind: string }[];
  readonly record: Readonly<Record<string, unknown>>;
}[] = [
  { resource: "alerts", fields: ALERT_FIELDS, record: {} },
  { resource: "nodes", fields: NODE_FIELDS, record: {} },
  { resource: "orders", fields: ORDER_FIELDS, record: {} },
  { resource: "spots", fields: SPOT_FIELDS, record: {} },
  { resource: "settlements", fields: SETTLEMENT_FIELDS, record: {} },
  { resource: "monitors", fields: MONITOR_FIELDS, record: {} },
];

/**
 * The field's value in a real record, by dotted path.
 *
 * The four resources whose read record is already write-shaped resolve directly; the
 * two whose read side holds money as an object — orders and settlements — are handed
 * the write-shaped row their panels build, since that is the row the form is seeded
 * from and a path that does not resolve *there* is a path the form cannot fill.
 */
async function loadRecords(): Promise<
  Map<ConsoleWriteResource, Readonly<Record<string, unknown>>>
> {
  const { consoleFixtures } = await import("./fixtures");
  const fixtures = consoleFixtures as unknown as Record<string, { readonly data: unknown }>;

  const rows = (section: string): readonly Record<string, unknown>[] =>
    fixtures[section]?.data as readonly Record<string, unknown>[];

  /**
   * The first row, and a failure rather than an empty record when the fixture has
   * none. An absent fixture silently reads as a record whose every column is
   * missing, which makes this test report six broken field names instead of one
   * missing fixture.
   */
  const first = (section: string): Record<string, unknown> => {
    const row = rows(section)[0];
    if (row === undefined) {
      throw new Error(`the ${section} fixture has no rows`);
    }
    return row;
  };

  const minor = (row: Record<string, unknown>, key: string): number =>
    (row[key] as { amountMinor: number }).amountMinor;
  const currency = (row: Record<string, unknown>, key: string): string =>
    (row[key] as { currency: string }).currency;

  // `market/book` and `market/prices` are documents, so their rows sit inside one.
  const order = (
    fixtures["market/book"] as {
      readonly data: { readonly orders: readonly Record<string, unknown>[] };
    }
  ).data.orders;
  if (order.length === 0) {
    throw new Error("the market/book fixture has no orders");
  }
  const alert = first("alerts/feed");
  const node = first("infrastructure/nodes");
  const movement = first("settlement/movements");
  const commitment = first("slas/commitments");
  const prices = (fixtures["market/prices"] as { readonly data: unknown }).data as {
    readonly latest: readonly Record<string, unknown>[];
  };
  const spot = firstPrice();

  function firstPrice(): Record<string, unknown> {
    const quote = (prices as { readonly latest: readonly Record<string, unknown>[] }).latest[0];
    if (quote === undefined) {
      throw new Error("the market/prices fixture has no latest quotes");
    }
    return quote;
  }

  return new Map<ConsoleWriteResource, Readonly<Record<string, unknown>>>([
    ["alerts", alert],
    ["nodes", node],
    ["monitors", commitment],
    // The two adapters the panels do, because the read side holds money as an object.
    [
      "orders",
      {
        ...order[0],
        priceMinor: minor(order[0] ?? {}, "unitPrice"),
        currency: currency(order[0] ?? {}, "unitPrice"),
      },
    ],
    [
      "spots",
      {
        pool: spot["pool"],
        priceMinor: minor(spot, "price"),
        currency: currency(spot, "price"),
        observedAt: spot["observedAt"],
      },
    ],
    [
      "settlements",
      {
        ...movement,
        amountMinor: minor(movement, "amount"),
        feeMinor: minor(movement, "fee"),
        currency: currency(movement, "amount"),
      },
    ],
  ]);
}

/** Read a dotted path out of a record, the way the form does. */
function read(record: Readonly<Record<string, unknown>>, path: string): unknown {
  let node: unknown = record;
  for (const key of path.split(".")) {
    if (typeof node !== "object" || node === null) {
      return undefined;
    }
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("an editor's fields are the contract's columns", () => {
  test("every field name resolves in a real record of its resource", async () => {
    const records = await loadRecords();

    for (const form of FORMS) {
      const record = records.get(form.resource) ?? {};

      for (const field of form.fields) {
        expect(
          read(record, field.name),
          `${form.resource}: "${field.name}" is not a column of the record it edits`,
        ).not.toBeUndefined();
      }
    }
  });

  test("no field is listed twice", () => {
    for (const form of FORMS) {
      const names = form.fields.map((field) => field.name);
      expect([...new Set(names)], form.resource).toHaveLength(names.length);
    }
  });

  test("a number says what unit it is in, or bounds or steps itself", () => {
    for (const form of FORMS) {
      for (const field of form.fields) {
        if (field.kind !== "number") {
          continue;
        }
        const spec = field as { hint?: string; min?: number; max?: number; step?: number };
        const described =
          spec.hint !== undefined ||
          spec.min !== undefined ||
          spec.max !== undefined ||
          spec.step !== undefined;
        expect(described, `${form.resource}.${field.name} does not say what its number means`).toBe(
          true,
        );
      }
    }
  });

  test("a create names its row, because the service has no generator to do it", () => {
    for (const form of FORMS) {
      // A spot is the exception the schema itself states: its id is the column's and
      // the upsert is addressed by `(pool, observedAt)`, so a form offering an id
      // would be offering one that cannot be stored.
      const wanted = form.resource === "spots" ? 0 : 1;

      expect(
        form.fields.filter((field) => field.name === "id"),
        `${form.resource} has ${form.fields.filter((f) => f.name === "id").length} id fields`,
      ).toHaveLength(wanted);
    }
  });

  test("an id is offered for a create and never carried on a patch", () => {
    for (const form of FORMS) {
      const id = form.fields.find((field) => field.name === "id");
      if (id === undefined) {
        continue;
      }

      const spec = id as { createOnly?: boolean; fresh?: () => string };
      expect(spec.createOnly, `${form.resource}.id is sent on a patch`).toBe(true);
      // A patch schema is strict, so an `id` on a `PATCH` is an unrecognised key —
      // a refusal naming a field that is not in the form.
      expect(typeof spec.fresh, `${form.resource}.id has nothing to open on`).toBe("function");

      const generated = spec.fresh?.() ?? "";
      expect(
        generated.startsWith(WRITE_ID_PREFIXES[form.resource]),
        `${form.resource}.id opened on "${generated}"`,
      ).toBe(true);
    }
  });

  test("a select offers only values the service will accept", () => {
    for (const form of FORMS) {
      for (const field of form.fields) {
        if (field.kind !== "select") {
          continue;
        }

        const options = (field as { options?: readonly { value: string }[] }).options ?? [];
        expect(
          options.length,
          `${form.resource}.${field.name} is a select with nothing in it, so it opens on nothing`,
        ).toBeGreaterThan(0);
      }
    }
  });

  test("a field that cannot be edited says why", () => {
    for (const form of FORMS) {
      for (const field of form.fields) {
        const spec = field as { lockedWhenEditing?: string };
        if (spec.lockedWhenEditing === undefined) {
          continue;
        }
        expect(spec.lockedWhenEditing.trim().length).toBeGreaterThan(20);
      }
    }
  });
});

describe("a select offers the contract's vocabulary, not a hand-written one", () => {
  /**
   * Keyed by resource *and* field, because two resources call different vocabularies
   * by the same name: a node's `kind` is an `ixp` and a movement's is a `payout`. A
   * map keyed on the field name alone would check one resource's options against the
   * other's and let a swap through.
   */
  const VOCABULARIES: Readonly<Record<string, readonly string[]>> = {
    "alerts.category": ALERT_CATEGORIES,
    "alerts.severity": ALERT_SEVERITIES,
    "nodes.kind": NODE_KINDS,
    "nodes.status": NODE_STATUSES,
    "orders.pool": MARKET_POOLS,
    "orders.side": MARKET_SIDES,
    "orders.currency": CURRENCIES,
    "spots.pool": MARKET_POOLS,
    "spots.currency": CURRENCIES,
    "settlements.kind": SETTLEMENT_KINDS,
    "settlements.status": TRANSACTION_STATUSES,
    "settlements.currency": CURRENCIES,
  };

  test("every option value is a member of the vocabulary it draws from", () => {
    for (const form of FORMS) {
      for (const field of form.fields) {
        const options = (field as { options?: readonly { value: string }[] }).options;
        if (options === undefined) {
          continue;
        }

        const vocabulary = VOCABULARIES[`${form.resource}.${field.name}`];
        expect(
          vocabulary,
          `${form.resource}.${field.name} has no vocabulary this test knows`,
        ).toBeDefined();

        for (const option of options) {
          expect(vocabulary ?? [], `${option.value} is not a ${field.name}`).toContain(
            option.value,
          );
        }
      }
    }
  });

  test("a select offers every member of its vocabulary, not a subset", () => {
    for (const [key, vocabulary] of Object.entries(VOCABULARIES)) {
      const [resource, fieldName] = key.split(".") as [string, string];
      const field = FORMS.find((form) => form.resource === resource)?.fields.find(
        (candidate) => candidate.name === fieldName,
      );
      const options = (field as { options?: readonly { value: string }[] } | undefined)?.options;

      expect(
        options?.map((option) => option.value).toSorted(),
        `${key} does not offer all ${vocabulary.length} members`,
      ).toEqual([...vocabulary].toSorted());
    }
  });
});
describe("one mutation module per writable resource", () => {
  test("a module exists for each resource the contract names, and no others", () => {
    const modules = readdirSync(MUTATIONS_DIRECTORY, { withFileTypes: true })
      // `_transport` is the shared transport every module calls, not a resource's
      // module: the underscore is this app's prefix for a module beside the
      // resource ones, the same one the API routes use for `_proxy` and `_handlers`.
      .filter(
        (entry) => entry.isFile() && entry.name.endsWith(".ts") && !entry.name.startsWith("_"),
      )
      .map((entry) => entry.name.replace(/\.ts$/, ""))
      .toSorted();

    expect(modules).toEqual([...CONSOLE_WRITE_RESOURCES].toSorted());
  });

  test("only a deletable resource offers a delete", async () => {
    for (const resource of CONSOLE_WRITE_RESOURCES) {
      const source = readFileSync(new URL(`${resource}.ts`, MUTATIONS_DIRECTORY), "utf8");
      const offers = /^export function delete/m.test(source);
      const deletable = DELETABLE_WRITE_RESOURCES.includes(resource as never);

      expect(offers, `${resource} ${offers ? "offers" : "does not offer"} a delete`).toBe(
        deletable,
      );
    }
  });

  test("an editor creates with a post and edits with a patch, never a put", async () => {
    for (const resource of CONSOLE_WRITE_RESOURCES) {
      const source = readFileSync(new URL(`${resource}.ts`, MUTATIONS_DIRECTORY), "utf8");
      expect(source, `${resource} offers a replace`).not.toMatch(/^export function replace/m);
    }
  });
});

describe("the transport", () => {
  test("posts to the resource's own path with a JSON body and no cache", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "a1" }), { status: 201 });
    });

    const result = await writeResource("alerts", "POST", { title: "t" });

    expect(calls[0]?.url).toBe("/api/v1/data/alerts");
    expect(calls[0]?.init.body).toBe('{"title":"t"}');
    expect(calls[0]?.init.cache).toBe("no-store");
    expect(result).toEqual({ status: "ok", record: { id: "a1" } });
  });

  test("patches a record by its id, and escapes it", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(url);
      return new Response("{}", { status: 200 });
    });

    await writeResource("nodes", "PATCH", { name: "n" }, "n 1/2");

    expect(calls[0]).toBe("/api/v1/data/nodes/n%201%2F2");
  });

  test("a removal sends no body and a 204 is a success with nothing in it", async () => {
    const calls: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      calls.push(init);
      return new Response(null, { status: 204 });
    });

    const result = await writeResource("orders", "DELETE", undefined, "o1");

    expect(calls[0]?.body).toBeUndefined();
    expect(calls[0]?.headers).toBeUndefined();
    expect(result.status).toBe("ok");
  });

  test("a refusal keeps the service's message and the paths of the fields it named", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            code: "validation_failed",
            responseCode: ResponseCode.ValidationFailed,
            message: "kind is not a node kind",
            details: {
              issues: [
                { path: ["kind"], message: "unsupported kind", code: "invalid_value" },
                { path: ["sla", "targetBps"], message: "too high", code: "too_big" },
              ],
            },
          }),
          { status: 422 },
        ),
    );

    const result = await writeResource("monitors", "POST", { kind: "x" });

    if (result.status !== "refused") {
      throw new Error(`expected a refusal, got ${result.status}`);
    }

    expect(result.fields.map((fault) => fault.path)).toEqual(["kind", "sla.targetBps"]);
    expect(result.message).toBe("kind is not a node kind");
  });

  test("an unreachable proxy is not a refusal, and blames no field", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });

    const result = await writeResource("spots", "POST", {});

    if (result.status !== "unreachable") {
      throw new Error(`expected the proxy to be unreachable, got ${result.status}`);
    }

    expect(result.fields).toEqual([]);
  });
});

describe("the routes", () => {
  test("every writable resource has a collection and a record route", () => {
    for (const resource of CONSOLE_WRITE_RESOURCES) {
      const collection = readFileSync(new URL(`${resource}/route.ts`, ROUTES_DIRECTORY), "utf8");
      const record = readFileSync(new URL(`${resource}/[id]/route.ts`, ROUTES_DIRECTORY), "utf8");

      expect(collection, `${resource} has no POST`).toMatch(/export const POST/);
      expect(record, `${resource} has no GET`).toMatch(/export const GET/);
      expect(record, `${resource} has no PATCH`).toMatch(/export const PATCH/);
    }
  });

  test("only a deletable resource's record route exports a delete", () => {
    for (const resource of CONSOLE_WRITE_RESOURCES) {
      const record = readFileSync(new URL(`${resource}/[id]/route.ts`, ROUTES_DIRECTORY), "utf8");
      const declares = /export const DELETE/.test(record);
      const deletable = DELETABLE_WRITE_RESOURCES.includes(resource as never);

      expect(declares, `${resource} route declares ${declares ? "" : "no "}DELETE`).toBe(deletable);
    }
  });

  test("a collection's put belongs only to the resource with a natural key", () => {
    const puts = CONSOLE_WRITE_RESOURCES.filter((resource) =>
      /export const PUT/.test(
        readFileSync(new URL(`${resource}/route.ts`, ROUTES_DIRECTORY), "utf8"),
      ),
    );

    expect(puts).toEqual(["spots"]);
  });

  test("a record route's put belongs only to a resource addressed by its own id", () => {
    const puts = CONSOLE_WRITE_RESOURCES.filter((resource) =>
      /export const PUT/.test(
        readFileSync(new URL(`${resource}/[id]/route.ts`, ROUTES_DIRECTORY), "utf8"),
      ),
    );

    // A spot's key is `(pool, observedAt)` and its id is the column's, so there is
    // nothing for a path id to address: `spots` is the one resource whose upsert is
    // on the collection. A `PUT` here would forward to a path the service does not
    // declare and answer 404, so the export is the defect rather than the omission.
    expect(puts).toEqual(["alerts", "nodes", "orders", "settlements", "monitors"]);
  });
});
