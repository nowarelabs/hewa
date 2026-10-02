"use client";

import type { MonitorCreate, MonitorPatch, MonitorWrite, SlaMonitor } from "@hewa/console-types";

import { writeResource, type WriteResult } from "./_transport";

/**
 * Writing a monitored commitment.
 *
 * The state is not among the fields, and that is the whole point of this module
 * being small: `state` is derived from the four basis-point columns by the service,
 * so a browser that could set it could declare a commitment compliant by writing a
 * word. There is no removal either — a commitment is written forward as met, at
 * risk or breached.
 */
export type { MonitorCreate, MonitorPatch, MonitorWrite, SlaMonitor };

/**
 * `POST`: a new monitor the console names.
 *
 * A create is a 409 if the id is taken rather than an update, because an operator
 * who pressed "New" twice did not mean to overwrite the first one — and the service
 * deciding that is one rule rather than six forms each deciding it.
 */
export function createMonitor(body: MonitorCreate): Promise<WriteResult<SlaMonitor>> {
  return writeResource<SlaMonitor>("monitors", "POST", body);
}

/**
 * `PATCH`: change the fields the body names and leave the rest of the row alone.
 *
 * An empty body is a read that changes nothing, which the service answers as a 200
 * with the record. That is worth knowing here because an editor that submits an
 * unchanged form has said nothing and must not claim it did.
 */
export function patchMonitor(id: string, body: MonitorPatch): Promise<WriteResult<SlaMonitor>> {
  return writeResource<SlaMonitor>("monitors", "PATCH", body, id);
}
