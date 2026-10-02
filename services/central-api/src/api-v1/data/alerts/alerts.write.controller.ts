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
import type { Alert, AlertCreate, AlertPatch, AlertWrite } from "@hewa/console-types";
import type { Response } from "express";

import { API_V1_PREFIX } from "../../prefix.js";
import { ServiceTokenGuard } from "../../service-token.guard.js";
import { WriteTokenGuard } from "../../write-token.guard.js";
import {
  alertCreateSchema,
  alertPatchSchema,
  alertUpsertSchema,
  RESOURCE_ID_SCHEMA,
} from "../write-schemas.js";
import { setUpsertStatus } from "../write-support.js";
import { ZodBody, ZodParam } from "../zod-pipe.js";
import { AlertsWriteService } from "./alerts.write.service.js";

/**
 * `api/v1/data/alerts` — create, read one, replace, patch. No delete.
 *
 * ## Why `/data` and not `/alerts`
 *
 * The view routes are `/alerts/{feed,outages,capacity,security}`, and three of those
 * four are rollups: a grouped outage is a sum over this table, and a capacity alert
 * is joined against a node's current headroom. Adding `POST /alerts/feed` beside them
 * would say the *feed* is writable, and it is not — a feed is an ordering. So the
 * writable routes live under `/data`, named for the table, which is the level at
 * which something is actually created. The contract's `CONSOLE_WRITE_RESOURCES` is
 * named for the same reason: a view has sections, and a section is a question rather
 * than a thing.
 *
 * ## Both guards, always
 *
 * `@UseGuards(ServiceTokenGuard, WriteTokenGuard)` rather than only the write one. A
 * write is a read of the record's previous state as far as the caller is concerned,
 * and the two credentials answer different questions: the read token is what the
 * browser's proxy holds, the write token is what an operator's console presents. A
 * deployment can therefore hand the first to a service that only watches.
 *
 * ## No `@Delete`
 *
 * Two of the six resources accept a delete and four do not, and the difference is the
 * point — see the module comment on `writes.ts`. A route that does not exist answers
 * 404, which is a weaker answer than the one this file would have to give: that
 * deleting a settlement line is refused on purpose and never will be permitted.
 *
 * The handler is a passthrough on purpose. Every decision worth naming — created or
 * replaced, absent or refused — is made in the service, so the same rule holds for
 * all six resources and there is one place per resource to look for it.
 */
@Controller(`${API_V1_PREFIX}/data/alerts`)
@UseGuards(ServiceTokenGuard, WriteTokenGuard)
export class AlertsWriteController {
  constructor(private readonly service: AlertsWriteService) {}

  /** 201 on the way in, because a create made a row that was not there. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body(new ZodBody(alertCreateSchema, "alert create")) body: AlertCreate) {
    return this.service.create(body);
  }

  /** The one record, which is what an editor opens on. */
  @Get(":id")
  async readOne(@Param("id", new ZodParam(RESOURCE_ID_SCHEMA, "alert id")) id: string) {
    return this.service.readOne(id);
  }

  /** 201 or 200 depending on whether the row was there, decided from the row written. */
  @Put(":id")
  async upsert(
    @Param("id", new ZodParam(RESOURCE_ID_SCHEMA, "alert id")) id: string,
    @Body(new ZodBody(alertUpsertSchema, "alert replace")) body: AlertWrite,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { alert, created } = await this.service.upsert(id, body);
    setUpsertStatus(res, created);
    return alert satisfies Alert;
  }

  @Patch(":id")
  async patch(
    @Param("id", new ZodParam(RESOURCE_ID_SCHEMA, "alert id")) id: string,
    @Body(new ZodBody(alertPatchSchema, "alert patch")) body: AlertPatch,
  ) {
    return this.service.patch(id, body);
  }
}
