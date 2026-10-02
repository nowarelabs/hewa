"use client";

import type { ConsoleWriteResource } from "@hewa/console-types";

/**
 * The one place a panel's write goes to the network.
 *
 * A panel calls one of the six resource modules beside this one and gets a
 * {@link WriteResult}; it never builds a URL, never names a header, and never sees
 * a `Response`. That is the same bargain the read side makes in `state/query.ts` —
 * the difference is only which direction the call goes — and it is what lets the
 * proxy's two-token arrangement stay an implementation detail of this folder rather
 * than something six forms each know about.
 *
 * ## Why nothing is validated here
 *
 * Because central-api already is, in Zod, over the same contract these bodies are
 * typed by, and a second implementation of those rules in the browser is a second
 * answer to every one of them. The two disagree in the direction that costs most:
 * a form that accepts what the service refuses reports success and loses the edit.
 *
 * So the service's `422` is treated as the authority and its field paths are carried
 * through to the editor, which can then mark the offending input rather than
 * printing "validation failed" under a form the operator has just filled in.
 */

/** How a write ended. */
export type WriteResult<TRecord> =
  /** Saved. Carries the record the service answered with, not the one that was sent. */
  | { readonly status: "ok"; readonly record: TRecord }
  /** Refused by a field, or by the service for any other reason. */
  | { readonly status: "refused"; readonly message: string; readonly fields: readonly FieldFault[] }
  /**
   * Could not be asked: this app's own proxy or the service did not answer.
   *
   * Carries an empty `fields` so a panel reads one shape. It is not an empty
   * refusal, though, and the `status` is what says so: nothing was checked, so
   * there is nothing to blame a field for.
   */
  | {
      readonly status: "unreachable";
      readonly message: string;
      readonly fields: readonly FieldFault[];
    };

/** One field the service refused, and why. */
export interface FieldFault {
  /** Dotted path from the body root, e.g. `sla.actualBps`. Empty for the body itself. */
  readonly path: string;
  readonly message: string;
}

/**
 * Send one write to this app's own proxy and classify the answer.
 *
 * Every failure is a value rather than a throw: a save that the service refuses is
 * an ordinary outcome of an editor, and a `try`/`catch` around a form's submit is
 * the sort of plumbing that gets forgotten in one of six copies.
 */
export async function writeResource<TRecord>(
  resource: ConsoleWriteResource,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body: unknown,
  id?: string,
): Promise<WriteResult<TRecord>> {
  const path =
    id === undefined
      ? `/api/v1/data/${resource}`
      : `/api/v1/data/${resource}/${encodeURIComponent(id)}`;

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: method === "DELETE" ? undefined : { "content-type": "application/json" },
      ...(method === "DELETE" ? {} : { body: JSON.stringify(body) }),
      // A save must not be answered from a cache that holds the row we just
      // replaced: the panel would go on showing the old figure after a successful
      // write, and the operator would conclude the save had not landed.
      cache: "no-store",
    });
  } catch {
    return {
      status: "unreachable",
      message: `The console could not reach its own API for ${method} ${resource}`,
      fields: [],
    };
  }

  if (response.status === 204) {
    // A removal has no record to hand back. The caller knows which row it deleted,
    // and the list it refetches from is the only thing that has to change.
    return { status: "ok", record: undefined as TRecord };
  }

  const payload: unknown = await response.json().catch(() => null);

  if (response.ok) {
    return { status: "ok", record: payload as TRecord };
  }

  return { ...classify(payload, response.status), status: "refused" };
}

/**
 * The service's envelope, read into something an editor can show.
 *
 * `details.issues` is the Zod shape the pipes produce, and its `path` is what makes
 * a refusal actionable: a message naming `sla.actualBps` can be put under that input,
 * while "validation failed" cannot. A body that is not the shape we expect is
 * still reported — as the message the service sent — because a refusal with no
 * detail is still better than a refusal with no text.
 */
function classify(
  payload: unknown,
  status: number,
): {
  readonly message: string;
  readonly fields: readonly FieldFault[];
} {
  if (typeof payload !== "object" || payload === null) {
    return { message: `The write was refused with status ${status}`, fields: [] };
  }

  const body = payload as {
    message?: unknown;
    details?: { issues?: unknown };
  };
  const message =
    typeof body.message === "string" ? body.message : `The write was refused with status ${status}`;

  const issues = Array.isArray(body.details?.issues) ? body.details.issues : [];
  const fields: FieldFault[] = issues.flatMap((issue) => {
    if (typeof issue !== "object" || issue === null) {
      return [];
    }
    const { path, message: text } = issue as { path?: unknown; message?: unknown };
    return typeof text === "string" ? [{ path: dotted(path), message: text }] : [];
  });

  return { message, fields };
}

/**
 * A Zod issue's `path` as the one dotted string a field can be looked up by.
 *
 * Zod's segments are `string | number`, because an array element's index is a
 * number and `"rows.0.id"` is the address of a field and `"rows.[object Object].id"`
 * is not. A path we cannot read is an empty one, which marks the form's root rather
 * than a field that does not exist.
 */
function dotted(path: unknown): string {
  if (!Array.isArray(path)) {
    return "";
  }

  return path
    .map((segment) =>
      typeof segment === "number" ? String(segment) : typeof segment === "string" ? segment : "",
    )
    .filter((segment) => segment.length > 0)
    .join(".");
}
