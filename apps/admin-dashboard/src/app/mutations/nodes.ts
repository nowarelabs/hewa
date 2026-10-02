"use client";

import type { InfrastructureNode, NodeCreate, NodePatch, NodeWrite } from "@hewa/console-types";

import { writeResource, type WriteResult } from "./_transport";

/**
 * Writing a node.
 *
 * The one resource where a removal is a correction rather than an erasure: a node
 * that was decommissioned has to go, or it keeps appearing in the rollups with a
 * status nobody can express. Its monitors go with it — the schema cascades — so
 * removing a node is also removing the record of what it was measured against.
 */
export type { InfrastructureNode, NodeCreate, NodePatch, NodeWrite };

/**
 * `POST`: a new node the console names.
 *
 * A create is a 409 if the id is taken rather than an update, because an operator
 * who pressed "New" twice did not mean to overwrite the first one — and the service
 * deciding that is one rule rather than six forms each deciding it.
 */
export function createNode(body: NodeCreate): Promise<WriteResult<InfrastructureNode>> {
  return writeResource<InfrastructureNode>("nodes", "POST", body);
}

/**
 * `PATCH`: change the fields the body names and leave the rest of the row alone.
 *
 * An empty body is a read that changes nothing, which the service answers as a 200
 * with the record. That is worth knowing here because an editor that submits an
 * unchanged form has said nothing and must not claim it did.
 */
export function patchNode(id: string, body: NodePatch): Promise<WriteResult<InfrastructureNode>> {
  return writeResource<InfrastructureNode>("nodes", "PATCH", body, id);
}

/**
 * `DELETE`: withdraw the node.
 *
 * The 204 has no body, so nothing is returned to draw — the list is refetched and
 * this is the only thing in the app that ever removes a row from it.
 */
export function deleteNode(id: string): Promise<WriteResult<InfrastructureNode>> {
  return writeResource<InfrastructureNode>("nodes", "DELETE", undefined, id);
}
