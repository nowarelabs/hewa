"use client";

import type { MarketOrder, OrderCreate, OrderPatch, OrderWrite } from "@hewa/console-types";

import { writeResource, type WriteResult } from "./_transport";

/**
 * Writing an order.
 *
 * Four verbs, and the fourth is why the other three are safe: an order is a resting
 * quote rather than a fact, so withdrawing one is a normal thing to do. Every write
 * here is also checked against the currency the book is already quoted in — one
 * book cannot be half USD and half USDC, and the service refuses the write that
 * would make it so rather than answering 422 to every later read.
 */
export type { MarketOrder, OrderCreate, OrderPatch, OrderWrite };

/**
 * `POST`: a new order the console names.
 *
 * A create is a 409 if the id is taken rather than an update, because an operator
 * who pressed "New" twice did not mean to overwrite the first one — and the service
 * deciding that is one rule rather than six forms each deciding it.
 */
export function createOrder(body: OrderCreate): Promise<WriteResult<MarketOrder>> {
  return writeResource<MarketOrder>("orders", "POST", body);
}

/**
 * `PATCH`: change the fields the body names and leave the rest of the row alone.
 *
 * An empty body is a read that changes nothing, which the service answers as a 200
 * with the record. That is worth knowing here because an editor that submits an
 * unchanged form has said nothing and must not claim it did.
 */
export function patchOrder(id: string, body: OrderPatch): Promise<WriteResult<MarketOrder>> {
  return writeResource<MarketOrder>("orders", "PATCH", body, id);
}

/**
 * `DELETE`: withdraw the order.
 *
 * The 204 has no body, so nothing is returned to draw — the list is refetched and
 * this is the only thing in the app that ever removes a row from it.
 */
export function deleteOrder(id: string): Promise<WriteResult<MarketOrder>> {
  return writeResource<MarketOrder>("orders", "DELETE", undefined, id);
}
