// @vitest-environment happy-dom

import { createElement, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { ALERT_FIELDS, AlertEditor } from "../src/app/panels/alerts";
import { NODE_FIELDS, NodeEditor } from "../src/app/panels/infrastructure";
import { ORDER_FIELDS, OrderEditor, SPOT_FIELDS, SpotEditor } from "../src/app/panels/market";
import { SETTLEMENT_FIELDS, SettlementEditor } from "../src/app/panels/settlement";
import { MONITOR_FIELDS, MonitorEditor } from "../src/app/panels/slas";
import type { FieldSpec } from "../src/app/ui/editor";
import { consoleFixtures } from "./fixtures";
import { mountInteractive, press, submit, unmountAll } from "./harness";

/**
 * What a form actually sends, mounted and pressed.
 *
 * The other write tests read field lists as data, and that cannot see the two ways a
 * form can send a body the contract will not take. Both reached the service during
 * development and neither left a trace in that suite:
 *
 * - **An untouched `<select>` sent `""`.** A controlled select whose value matches no
 *   option cannot hold that value — the browser draws the first option while React's
 *   state still says `""`. So a form showing `bid` sent an empty string, and the
 *   refusal read `expected one of "bid"|"offer"` on a control that was visibly set.
 *   Only a mounted form shows that, because only a browser has both halves.
 * - **A create sent no `id` at all.** The columns are `varchar` primary keys with no
 *   generator behind the service, so a create has to name its row and the field lists
 *   had nothing to say so. The service answered `expected string, received undefined`
 *   at `id`: a refusal about a field that was never on screen.
 *
 * So this file presses save and reads the bytes. The body is taken off `fetch`, the
 * one place it exists, rather than from `bodyFrom` — a test that called the assembler
 * directly would be asserting its opinion of itself, and both defects above were about
 * the distance between what was drawn and what the assembler was handed.
 */

/** The last body to leave, and the path it left by. */
interface Sent {
  readonly path: string;
  readonly method: string;
  readonly body: Record<string, unknown>;
}

let sent: Sent[] = [];

beforeEach(() => {
  sent = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init: RequestInit = {}) => {
      sent.push({
        path: String(input),
        method: init.method ?? "GET",
        // `RequestInit["body"]` is typed wider than what `fetch` will carry, and the
        // widening includes a value whose `String()` is `[object Object]` — so the
        // text is read through the same check the transport's own does rather than
        // through a cast that would silence it.
        body: typeof init.body === "string" ? JSON.parse(init.body) : {},
      });
      return new Response(JSON.stringify({ id: "written" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }),
  );
});

afterEach(() => {
  unmountAll();
  vi.unstubAllGlobals();
});

/**
 * The one write that left, ignoring the refetch that follows it.
 *
 * A save refetches the section it changed, so a successful create leaves two
 * requests behind. Reading `sent[0]` alone would work by accident — it works today
 * only because the write is always first — so the refetch is dropped by verb rather
 * than by position.
 */
function only(): Sent {
  const writes = sent.filter((request) => request.method !== "GET");
  expect(
    writes,
    `no write left; saw ${sent.map((r) => `${r.method} ${r.path}`).join(", ")}`,
  ).toHaveLength(1);
  return writes[0] as Sent;
}

/** The one form an editor drew, or a loud failure rather than a silent `null`. */
function formIn(container: HTMLElement): HTMLFormElement {
  const form = container.querySelector("form");
  expect(form, "the editor drew no form").not.toBeNull();
  return form as HTMLFormElement;
}

/**
 * Mount an editor, ask it for a new record, and save without touching a control.
 *
 * Nothing is typed on purpose: an untouched form is the one that cannot rely on an
 * operator having chosen a value, and every defect this file exists for was one a
 * form looked correct about while sending nothing.
 */
async function saveNew(element: ReactElement): Promise<Sent> {
  // Reset here rather than in `beforeEach`, because each test drives all six editors
  // and the point of the file is comparing them: a running total would have the third
  // editor's assertions read the first one's request.
  sent = [];

  const { container } = mountInteractive(element);

  const startNew = [...container.querySelectorAll("button")].find((button) =>
    (button.textContent ?? "").startsWith("New "),
  );
  expect(startNew, "the editor offered no way to create a record").toBeDefined();
  await press(startNew as HTMLButtonElement);

  await submit(formIn(container));

  return only();
}

/** Every editor, with the field list it sends, so a refusal can name the spec. */
const EDITORS: readonly {
  readonly resource: string;
  readonly element: ReactElement;
  readonly fields: readonly FieldSpec[];
}[] = [
  {
    resource: "alerts",
    element: createElement(AlertEditor, { section: null }),
    fields: ALERT_FIELDS,
  },
  { resource: "nodes", element: createElement(NodeEditor, { section: null }), fields: NODE_FIELDS },
  {
    resource: "orders",
    element: createElement(OrderEditor, { section: null }),
    fields: ORDER_FIELDS,
  },
  { resource: "spots", element: createElement(SpotEditor, { section: null }), fields: SPOT_FIELDS },
  {
    resource: "settlements",
    element: createElement(SettlementEditor, { section: null }),
    fields: SETTLEMENT_FIELDS,
  },
  {
    resource: "monitors",
    element: createElement(MonitorEditor, { section: null }),
    fields: MONITOR_FIELDS,
  },
];

describe("an editor's first save", () => {
  test("every create names its row, except the one whose column does it", async () => {
    for (const { resource, element, fields } of EDITORS) {
      const body = (await saveNew(element)).body;
      unmountAll();

      if (resource === "spots") {
        // A spot's id is the column's own and its upsert is addressed by
        // `(pool, observedAt)`, so an id in the body would be a key nothing reads.
        expect(body, resource).not.toHaveProperty("id");
      } else {
        expect(typeof body["id"], `${resource} sent no id`).toBe("string");
        expect(
          (body["id"] as string).length,
          `${resource} sent an id of no length`,
        ).toBeGreaterThan(3);
      }

      expect(fields.length, resource).toBeGreaterThan(0);
    }
  });

  test("an untouched select sends the option the browser is already drawing", async () => {
    for (const { resource, element, fields } of EDITORS) {
      const body = (await saveNew(element)).body;
      unmountAll();

      for (const [name, value] of Object.entries(body)) {
        const field = fields.find((candidate) => candidate.name === name);
        const kind = field?.kind ?? "(not in the field list)";

        expect(value, `${resource}.${name} is ${kind} and was sent as "${String(value)}"`).not.toBe(
          "",
        );
        expect(
          value,
          `${resource}.${name} is ${kind} and was sent nothing at all`,
        ).not.toBeUndefined();
      }
    }
  });

  test("a patch carries no id, because the patch schemas are strict", async () => {
    const orders = (consoleFixtures["market/book"] as { data: { orders: { id: string }[] } }).data
      .orders;
    const first = orders[0];
    expect(first, "the market/book fixture has no orders").toBeDefined();
    const id = (first as { id: string }).id;

    sent = [];
    const { container } = mountInteractive(createElement(OrderEditor, { section: id }));
    await submit(formIn(container));

    const request = only();
    expect(request.method).toBe("PATCH");
    expect(request.path).toBe(`/api/v1/data/orders/${id}`);
    // An `id` here comes back as an unrecognised key: a refusal naming a field that
    // is not in the form, on a save nobody asked to be a rename.
    expect(request.body).not.toHaveProperty("id");
  });
});
