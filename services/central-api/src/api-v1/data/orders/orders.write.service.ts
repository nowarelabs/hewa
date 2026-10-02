import { Inject, Injectable } from "@nestjs/common";
import { NotFoundError } from "@hewa/errors";
import type { MarketOrder, OrderCreate, OrderPatch, OrderWrite } from "@hewa/console-types";
import { eq, getTableColumns } from "drizzle-orm";

import { DB, type Database } from "../../../db/db.module.js";
import { marketOrders } from "../../../db/schema.js";
import { assertQuoteCurrency } from "../../quote-currency.js";
import { orderRecord } from "../records.js";
import { write } from "../write-errors.js";
import { defined, deleted, inserted, updated, upserted, WAS_CREATED } from "../write-support.js";

/**
 * The columns a create or a replace sets.
 *
 * Money arrives as two columns — `priceMinor` and `currency` — rather than as a
 * `Money` object, so a settlement line and an order price are described the same
 * way; see `writes.ts` for why a write payload is not the read model.
 */
function orderColumns(write: OrderWrite): Omit<typeof marketOrders.$inferInsert, "id"> {
  return {
    pool: write.pool,
    side: write.side,
    provider: write.provider,
    committedGbps: write.committedGbps,
    burstGbps: write.burstGbps,
    priceMinor: write.priceMinor,
    currency: write.currency,
    submittedAt: new Date(write.submittedAt),
  };
}

/**
 * The columns a patch sets, and only those the body mentioned.
 *
 * A patch cannot check `burstGbps` against `committedGbps` — it sets one of the two
 * and relies on the stored value for the other — so the pair is left to
 * `market_orders_burst_gte_committed`, which sees both columns on every write
 * whoever made it. The refusal arrives as a 422 naming the constraint; see
 * `write-errors.ts`.
 */
function orderPatchColumns(patch: OrderPatch): Partial<typeof marketOrders.$inferInsert> {
  return {
    pool: patch.pool,
    side: patch.side,
    provider: patch.provider,
    committedGbps: patch.committedGbps,
    burstGbps: patch.burstGbps,
    priceMinor: patch.priceMinor,
    currency: patch.currency,
    submittedAt: patch.submittedAt === undefined ? undefined : new Date(patch.submittedAt),
  };
}

/**
 * Create, read, replace, patch **and delete**, for `market_orders`.
 *
 * The second of the two tables that accept a delete, and the one where it is least
 * contentious: a resting order that has been withdrawn is not a fact about the
 * market that should be preserved, it is a bid somebody no longer wants to make.
 *
 /**
 * Nothing here recomputes the book's figures. `market/book` derives `bestBid`,
 * `bestOffer` and `committedGbps` from the orders by the same query that returns
 * them, so a write moves those numbers because they were derived rather than stored
 * — there is no rollup table for a write to forget to update.
 *
 * ## One currency, checked before the write
 *
 * `market/book` refuses to answer a book quoted in two currencies, because
 * `MarketBook` declares one `currency` for the whole payload and a mixed book has no
 * honest rendering. That refusal costs a query and no state, so without a check here
 * one operator writing `USDC` on a USD book would make the market view answer 422 for
 * everybody. So a write that sets `currency` asks first, using the same function the
 * read uses — see `quote-currency.ts`.
 */
@Injectable()
export class OrdersWriteService {
  static readonly RESOURCE = "order";

  constructor(@Inject(DB) private readonly db: Database) {}

  /** `POST /api/v1/data/orders`. A duplicate id is a 409, not a merge. */
  async create(body: OrderCreate): Promise<MarketOrder> {
    await this.assertQuotedIn(body.currency);
    const row = inserted(
      await write(OrdersWriteService.RESOURCE, () =>
        this.db
          .insert(marketOrders)
          .values({ id: body.id, ...orderColumns(body) })
          .returning(),
      ),
      OrdersWriteService.RESOURCE,
      body.id,
    );
    return orderRecord(row);
  }

  /** `GET /api/v1/data/orders/:id`. The one record, or a 404 naming it. */
  async readOne(id: string): Promise<MarketOrder> {
    const rows = await this.db.select().from(marketOrders).where(eq(marketOrders.id, id)).limit(1);
    const row = rows[0];
    if (row === undefined) {
      throw new NotFoundError(OrdersWriteService.RESOURCE, id);
    }
    return orderRecord(row);
  }

  /** `PUT /api/v1/data/orders/:id`. 201 when it was not there, 200 when it was. */
  async upsert(id: string, body: OrderWrite): Promise<{ order: MarketOrder; created: boolean }> {
    await this.assertQuotedIn(body.currency);
    const columns = orderColumns(body);
    const result = upserted(
      await write(OrdersWriteService.RESOURCE, () =>
        this.db
          .insert(marketOrders)
          .values({ id, ...columns })
          .onConflictDoUpdate({ target: marketOrders.id, set: columns })
          .returning({ ...getTableColumns(marketOrders), wasCreated: WAS_CREATED }),
      ),
      OrdersWriteService.RESOURCE,
      id,
    );
    return { order: orderRecord(result), created: result.wasCreated };
  }

  /** `PATCH /api/v1/data/orders/:id`. 404 when the order is not there. */
  async patch(id: string, patch: OrderPatch): Promise<MarketOrder> {
    const columns = defined(orderPatchColumns(patch));

    if (Object.keys(columns).length === 0) {
      return this.readOne(id);
    }

    // Only asked about when the body mentions it: a patch that leaves the currency
    // alone cannot change what the book is quoted in, and asking anyway would make a
    // one-field edit depend on every other row in the table.
    if (patch.currency !== undefined) {
      await this.assertQuotedIn(patch.currency);
    }

    const row = updated(
      await write(OrdersWriteService.RESOURCE, () =>
        this.db.update(marketOrders).set(columns).where(eq(marketOrders.id, id)).returning(),
      ),
      OrdersWriteService.RESOURCE,
      id,
    );
    return orderRecord(row);
  }

  /**
   * `DELETE /api/v1/data/orders/:id`.
   *
   * The order goes and nothing else moves: no node's committed capacity is touched,
   * because that is derived from the orders by `infrastructure/headroom` rather than
   * stored, and there is no counter to decrement.
   */
  async remove(id: string): Promise<void> {
    deleted(
      await write(OrdersWriteService.RESOURCE, () =>
        this.db
          .delete(marketOrders)
          .where(eq(marketOrders.id, id))
          .returning({ id: marketOrders.id }),
      ),
      OrdersWriteService.RESOURCE,
      id,
    );
  }

  /**
   * The currencies already on the book, deduplicated by the database.
   *
   * `selectDistinct` rather than reading every order and collecting in memory: this
   * runs before every write that sets a currency, and a book is the largest table in
   * this service.
   */
  private async assertQuotedIn(currency: OrderWrite["currency"]): Promise<void> {
    const stored = await this.db
      .selectDistinct({ currency: marketOrders.currency })
      .from(marketOrders);
    assertQuoteCurrency(stored, currency, "order book");
  }
}
