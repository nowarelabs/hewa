import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { InfrastructureNode, NodeCreate, NodePatch, NodeWrite } from "@hewa/console-types";
import type { Response } from "express";

import { API_V1_PREFIX } from "../../prefix.js";
import { ServiceTokenGuard } from "../../service-token.guard.js";
import { WriteTokenGuard } from "../../write-token.guard.js";
import {
  nodeCreateSchema,
  nodePatchSchema,
  nodeUpsertSchema,
  RESOURCE_ID_SCHEMA,
} from "../write-schemas.js";
import { setUpsertStatus } from "../write-support.js";
import { ZodBody, ZodParam } from "../zod-pipe.js";
import { NodesWriteService } from "./nodes.write.service.js";

/**
 * `api/v1/data/nodes` — the whole of CRUD, patch and upsert.
 *
 * One of only two resources with a `@Delete`, and the reason is in `writes.ts`: a
 * node can stop being true, so the row that described it should go. The other is
 * `orders`.
 *
 * Everything else about these routes — both guards, `/data` rather than the view's
 * namespace, the controller being a passthrough — is explained once on
 * `AlertsWriteController` and holds identically here. Six copies of that comment
 * would be six places to update one rule.
 */
@Controller(`${API_V1_PREFIX}/data/nodes`)
@UseGuards(ServiceTokenGuard, WriteTokenGuard)
export class NodesWriteController {
  constructor(private readonly service: NodesWriteService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body(new ZodBody(nodeCreateSchema, "node create")) body: NodeCreate) {
    return this.service.create(body);
  }

  @Get(":id")
  async readOne(@Param("id", new ZodParam(RESOURCE_ID_SCHEMA, "node id")) id: string) {
    return this.service.readOne(id);
  }

  @Put(":id")
  async upsert(
    @Param("id", new ZodParam(RESOURCE_ID_SCHEMA, "node id")) id: string,
    @Body(new ZodBody(nodeUpsertSchema, "node replace")) body: NodeWrite,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { node, created } = await this.service.upsert(id, body);
    setUpsertStatus(res, created);
    return node satisfies InfrastructureNode;
  }

  @Patch(":id")
  async patch(
    @Param("id", new ZodParam(RESOURCE_ID_SCHEMA, "node id")) id: string,
    @Body(new ZodBody(nodePatchSchema, "node patch")) body: NodePatch,
  ) {
    return this.service.patch(id, body);
  }

  /**
   * `DELETE /api/v1/data/nodes/:id` → 204.
   *
   * No body, and `HttpCode(204)` stated rather than left to Nest's default for a
   * delete, which is 200 with an empty body. 204 says the answer without inventing a
   * payload, and the panel already knows the id it removed.
   *
   * The cascade to `sla_monitors` is documented on `NodesWriteService.remove`.
   */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id", new ZodParam(RESOURCE_ID_SCHEMA, "node id")) id: string) {
    await this.service.remove(id);
  }
}
