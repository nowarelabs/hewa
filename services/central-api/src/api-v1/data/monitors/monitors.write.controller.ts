import {
  Body,
  Controller,
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
import type { MonitorCreate, MonitorPatch, MonitorWrite, SlaMonitor } from "@hewa/console-types";
import type { Response } from "express";

import { API_V1_PREFIX } from "../../prefix.js";
import { ServiceTokenGuard } from "../../service-token.guard.js";
import { WriteTokenGuard } from "../../write-token.guard.js";
import {
  monitorCreateSchema,
  monitorPatchSchema,
  monitorUpsertSchema,
  RESOURCE_ID_SCHEMA,
} from "../write-schemas.js";
import { setUpsertStatus } from "../write-support.js";
import { ZodBody, ZodParam } from "../zod-pipe.js";
import { MonitorsWriteService } from "./monitors.write.service.js";

/**
 * `api/v1/data/monitors` — create, read one, replace, patch. No delete.
 *
 * There is no `state` in any of the three bodies: the service computes it from the
 * basis points with `slaState`, the same comparison that decides whether the next
 * settlement run issues a credit. A payload that could set it would let the console
 * and the invoice disagree about the same commitment.
 *
 * Everything else about these routes is explained once on `AlertsWriteController`.
 */
@Controller(`${API_V1_PREFIX}/data/monitors`)
@UseGuards(ServiceTokenGuard, WriteTokenGuard)
export class MonitorsWriteController {
  constructor(private readonly service: MonitorsWriteService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body(new ZodBody(monitorCreateSchema, "monitor create")) body: MonitorCreate) {
    return this.service.create(body);
  }

  @Get(":id")
  async readOne(@Param("id", new ZodParam(RESOURCE_ID_SCHEMA, "monitor id")) id: string) {
    return this.service.readOne(id);
  }

  @Put(":id")
  async upsert(
    @Param("id", new ZodParam(RESOURCE_ID_SCHEMA, "monitor id")) id: string,
    @Body(new ZodBody(monitorUpsertSchema, "monitor replace")) body: MonitorWrite,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { monitor, created } = await this.service.upsert(id, body);
    setUpsertStatus(res, created);
    return monitor satisfies SlaMonitor;
  }

  @Patch(":id")
  async patch(
    @Param("id", new ZodParam(RESOURCE_ID_SCHEMA, "monitor id")) id: string,
    @Body(new ZodBody(monitorPatchSchema, "monitor patch")) body: MonitorPatch,
  ) {
    return this.service.patch(id, body);
  }
}
