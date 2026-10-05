"use client";

import type { FinanceWriteResource } from "@hewa/financial-dashboard-types";

/**
 * The one way a panel reaches a write endpoint.
 *
 * Every finance write goes to `/api/v1/data/<resource>`, and the resource name in
 * the path is the same string the finance contract's `FINANCE_WRITE_RESOURCES`
 * holds — so a route this app does not have is a 404 from the handler rather than
 * a request to central-api with a token attached.
 *
 * ## Nothing is validated in the browser
 *
 * central-api already validates every body in Zod over the same contract, and a
 * second implementation disagrees in the direction that costs most: a form that
 * accepts what the service refuses reports success and loses the edit. So the
 * service's `422` is the authority, `details.issues[].path` is joined into the
 * one dotted string `FieldSpec.name` is matched against, and `RecordEditor` marks
 * the offending input.
 */

export interface FieldFault {
  /** Dotted path from the body root, e.g. `postings.0.accountId`. Empty for the body itself. */
  readonly path: string;
  readonly message: string;
}

export type WriteResult<TRecord> =
  | { readonly status: "ok"; readonly record: TRecord }
  | { readonly status: "refused"; readonly message: string; readonly fields: readonly FieldFault[] }
  | {
      readonly status: "unreachable";
      readonly message: string;
      readonly fields: readonly FieldFault[];
    };

export async function writeResource<TRecord>(
  resource: FinanceWriteResource,
  method: "POST" | "PATCH",
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
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return {
      status: "unreachable",
      message: `The dashboard could not reach its own API for ${method} ${resource}`,
      fields: [],
    };
  }

  // A finance write never answers 204 — every one of them creates or updates a row
  // and answers with it — but a handler that forwards a bare 204 must not be read
  // as a missing body.
  if (response.status === 204) {
    return { status: "ok", record: undefined as TRecord };
  }

  const payload: unknown = await response.json().catch(() => null);

  if (response.ok) {
    return { status: "ok", record: payload as TRecord };
  }

  return { ...classify(payload, response.status), status: "refused" };
}

function classify(
  payload: unknown,
  status: number,
): { readonly message: string; readonly fields: readonly FieldFault[] } {
  if (typeof payload !== "object" || payload === null) {
    return { message: `The write was refused with status ${status}`, fields: [] };
  }

  const body = payload as { message?: unknown; details?: { issues?: unknown } };
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
