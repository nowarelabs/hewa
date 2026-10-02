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
import type { MarketOrder, OrderCreate, OrderPatch, OrderWrite } from "@hewa/console-types";
import type { Response } from "express";

import { API_V1_PREFIX } from "../../prefix.js";
import { ServiceTokenGuard } from "../../service-token.guard.js";
import { WriteTokenGuard } from "../../write-token.guard.js";
import {
  orderCreateSchema,
  orderPatchSchema,
  orderUpsertSchema,
  RESOURCE_ID_SCHEMA,
} from "../write-schemas.js";
import { setUpsertStatus } from "../write-support.js";
import { ZodBody, ZodParam } from "../zod-pipe.js";
import { OrdersWriteService } from "./orders.write.service.js";

/**
 * `api/v1/data/orders` — the whole of CRUD, patch and upsert.
 *
 * The second of the two resources with a `@Delete`; see `writes.ts` for why a
 * withdrawn order is removed rather than kept. Everything else about these routes is
 * explained once on `AlertsWriteController` and holds identically here.
 */
@Controller(`${API_V1_PREFIX}/data/orders`)
@UseGuards(ServiceTokenGuard, WriteTokenGuard)
export class OrdersWriteController {
  constructor(private readonly service: OrdersWriteService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body(new ZodBody(orderCreateSchema, "order create")) body: OrderCreate) {
    return this.service.create(body);
  }

  @Get(":id")
  async readOne(@Param("id", new ZodParam(RESOURCE_ID_SCHEMA, "order id")) id: string) {
    return this.service.readOne(id);
  }

  @Put(":id")
  async upsert(
    @Param("id", new ZodParam(RESOURCE_ID_SCHEMA, "order id")) id: string,
    @Body(new ZodBody(orderUpsertSchema, "order replace")) body: OrderWrite,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { order, created } = await this.service.upsert(id, body);
    setUpsertStatus(res, created);
    return order satisfies MarketOrder;
  }

  @Patch(":id")
  async patch(
    @Param("id", new ZodParam(RESOURCE_ID_SCHEMA, "order id")) id: string,
    @Body(new ZodBody(orderPatchSchema, "order patch")) body: OrderPatch,
  ) {
    return this.service.patch(id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id", new ZodParam(RESOURCE_ID_SCHEMA, "order id")) id: string) {
    await this.service.remove(id);
  }
}
