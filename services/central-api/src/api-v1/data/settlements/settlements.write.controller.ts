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
import type {
  Settlement,
  SettlementCreate,
  SettlementPatch,
  SettlementWrite,
} from "@hewa/console-types";
import type { Response } from "express";

import { API_V1_PREFIX } from "../../prefix.js";
import { ServiceTokenGuard } from "../../service-token.guard.js";
import { WriteTokenGuard } from "../../write-token.guard.js";
import {
  RESOURCE_ID_SCHEMA,
  settlementCreateSchema,
  settlementPatchSchema,
  settlementUpsertSchema,
} from "../write-schemas.js";
import { setUpsertStatus } from "../write-support.js";
import { ZodBody, ZodParam } from "../zod-pipe.js";
import { SettlementsWriteService } from "./settlements.write.service.js";

/**
 * `api/v1/data/settlements` — create, read one, replace, patch. No delete.
 *
 * The absence is the resource's strongest statement: a settlement line records that
 * money moved, and there is nowhere to put a correction that keeps the record. See
 * `SettlementsWriteService` and `writes.ts`.
 *
 * Everything else about these routes is explained once on `AlertsWriteController`.
 */
@Controller(`${API_V1_PREFIX}/data/settlements`)
@UseGuards(ServiceTokenGuard, WriteTokenGuard)
export class SettlementsWriteController {
  constructor(private readonly service: SettlementsWriteService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodBody(settlementCreateSchema, "settlement create")) body: SettlementCreate,
  ) {
    return this.service.create(body);
  }

  @Get(":id")
  async readOne(@Param("id", new ZodParam(RESOURCE_ID_SCHEMA, "settlement id")) id: string) {
    return this.service.readOne(id);
  }

  @Put(":id")
  async upsert(
    @Param("id", new ZodParam(RESOURCE_ID_SCHEMA, "settlement id")) id: string,
    @Body(new ZodBody(settlementUpsertSchema, "settlement replace")) body: SettlementWrite,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { settlement, created } = await this.service.upsert(id, body);
    setUpsertStatus(res, created);
    return settlement satisfies Settlement;
  }

  @Patch(":id")
  async patch(
    @Param("id", new ZodParam(RESOURCE_ID_SCHEMA, "settlement id")) id: string,
    @Body(new ZodBody(settlementPatchSchema, "settlement patch")) body: SettlementPatch,
  ) {
    return this.service.patch(id, body);
  }
}
