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
import type { SpotCreate, SpotPatch, SpotRecord, SpotWrite } from "@hewa/console-types";
import type { Response } from "express";

import { API_V1_PREFIX } from "../../prefix.js";
import { ServiceTokenGuard } from "../../service-token.guard.js";
import { WriteTokenGuard } from "../../write-token.guard.js";
import {
  SPOT_ID_SCHEMA,
  spotCreateSchema,
  spotPatchSchema,
  spotUpsertSchema,
} from "../write-schemas.js";
import { setUpsertStatus } from "../write-support.js";
import { ZodBody, ZodParam } from "../zod-pipe.js";
import { SpotsWriteService } from "./spots.write.service.js";

/**
 * `api/v1/data/spots` — create, read one, patch, and an upsert with **no id in the
 * path**. No delete.
 *
 * The shape of these routes is the resource's, not a convention's: a spot's id is
 * generated and its natural key is `(pool, observedAt)`, so the upsert matches on
 * that pair and answers 201 for a new observation and 200 for a corrected one. Every
 * other resource's upsert is `PUT /:id`, and reading the two side by side in
 * `data-writes.module.ts` is the fastest way to see which is which.
 *
 * Everything else about these routes is explained once on `AlertsWriteController`.
 */
@Controller(`${API_V1_PREFIX}/data/spots`)
@UseGuards(ServiceTokenGuard, WriteTokenGuard)
export class SpotsWriteController {
  constructor(private readonly service: SpotsWriteService) {}

  /**
   * `POST /api/v1/data/spots`.
   *
   * 409 when that pool has already been observed at that instant — the collision is
   * the natural key, so the message names the pair rather than an id nobody chose.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body(new ZodBody(spotCreateSchema, "spot create")) body: SpotCreate) {
    return this.service.create(body);
  }

  /** The upsert, on the natural key. 201 when it was a new observation, 200 when it was a correction. */
  @Put()
  async upsert(
    @Body(new ZodBody(spotUpsertSchema, "spot upsert")) body: SpotWrite,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { spot, created } = await this.service.upsert(body);
    setUpsertStatus(res, created);
    return spot satisfies SpotRecord;
  }

  @Get(":id")
  async readOne(@Param("id", new ZodParam(SPOT_ID_SCHEMA, "spot id")) id: number) {
    return this.service.readOne(id);
  }

  @Patch(":id")
  async patch(
    @Param("id", new ZodParam(SPOT_ID_SCHEMA, "spot id")) id: number,
    @Body(new ZodBody(spotPatchSchema, "spot patch")) body: SpotPatch,
  ) {
    return this.service.patch(id, body);
  }
}
