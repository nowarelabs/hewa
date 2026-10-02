"use client";

import type { Alert, AlertCreate, AlertPatch, AlertWrite } from "@hewa/console-types";

import { writeResource, type WriteResult } from "./_transport";

/**
 * Writing an alert.
 *
 * Three verbs, and no fourth. An alert is a record of something that happened,
 * so the contract gives it no removal: deleting one would erase the fact it
 * exists to keep. The severity can still be lowered and the description corrected,
 * which is the difference between a record that is wrong and a record that never
 * happened.
 */
export type { Alert, AlertCreate, AlertPatch, AlertWrite };

/**
 * `POST`: a new alert the console names.
 *
 * A create is a 409 if the id is taken rather than an update, because an operator
 * who pressed "New" twice did not mean to overwrite the first one — and the service
 * deciding that is one rule rather than six forms each deciding it.
 */
export function createAlert(body: AlertCreate): Promise<WriteResult<Alert>> {
  return writeResource<Alert>("alerts", "POST", body);
}

/**
 * `PATCH`: change the fields the body names and leave the rest of the row alone.
 *
 * An empty body is a read that changes nothing, which the service answers as a 200
 * with the record. That is worth knowing here because an editor that submits an
 * unchanged form has said nothing and must not claim it did.
 */
export function patchAlert(id: string, body: AlertPatch): Promise<WriteResult<Alert>> {
  return writeResource<Alert>("alerts", "PATCH", body, id);
}
