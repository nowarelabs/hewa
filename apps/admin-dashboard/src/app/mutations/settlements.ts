"use client";

import type {
  Settlement,
  SettlementCreate,
  SettlementPatch,
  SettlementWrite,
} from "@hewa/console-types";

import { writeResource, type WriteResult } from "./_transport";

/**
 * Writing a settlement line.
 *
 * No removal. A movement is money that moved, and a row that has been paid and then
 * deleted is indistinguishable from a row that was never paid — which is the one
 * ambiguity a settlement ledger cannot have. A line that turned out to be wrong is
 * reversed, and the reversal is another line.
 */
export type { Settlement, SettlementCreate, SettlementPatch, SettlementWrite };

/**
 * `POST`: a new settlement the console names.
 *
 * A create is a 409 if the id is taken rather than an update, because an operator
 * who pressed "New" twice did not mean to overwrite the first one — and the service
 * deciding that is one rule rather than six forms each deciding it.
 */
export function createSettlement(body: SettlementCreate): Promise<WriteResult<Settlement>> {
  return writeResource<Settlement>("settlements", "POST", body);
}

/**
 * `PATCH`: change the fields the body names and leave the rest of the row alone.
 *
 * An empty body is a read that changes nothing, which the service answers as a 200
 * with the record. That is worth knowing here because an editor that submits an
 * unchanged form has said nothing and must not claim it did.
 */
export function patchSettlement(
  id: string,
  body: SettlementPatch,
): Promise<WriteResult<Settlement>> {
  return writeResource<Settlement>("settlements", "PATCH", body, id);
}
