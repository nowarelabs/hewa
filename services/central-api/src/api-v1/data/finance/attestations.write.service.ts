import { Inject, Injectable } from "@nestjs/common";
import type { AttestationCreate, AttestationRecord } from "@hewa/financial-dashboard-types";
import { and, eq } from "drizzle-orm";

import { CLOCK, type Clock } from "../../../db/clock.js";
import { DB, type Database } from "../../../db/db.module.js";
import { financeAttestations } from "../../../db/schema.js";
import { attestationRecord, verdictFor } from "../../finance/records.js";
import { write } from "../write-errors.js";
import { inserted } from "../write-support.js";

/**
 * Publish a day of a city's revenue.
 *
 * ## `publishedAt` is stamped here, not sent
 *
 * A row in `finance_attestations` *is* a published attestation: the schema has no
 * `nullable` on that column and no draft state, because a figure nobody signed is
 * not a half-finished attestation — it is nothing. So the body carries no timestamp
 * (see `attestationCreateSchema`) and this service writes the clock's now.
 *
 * That is also the one field on this table that could be backdated by anybody holding
 * the write token, and it is worth saying why it still is not in the body: the panel
 * reads it as "published at", and a web form that could set it would let a reader be
 * told a month was attested before the date it was. The *signature* is the
 * attestation's real authority and it lives outside this table entirely — see the
 * note on `finance_attestations` in `db/schema.ts`.
 *
 * ## The clock is injected, so a test's month is the month it says
 *
 * `CLOCK` rather than `new Date()`. Every figure in `revenue/receivables` ages off
 * the same clock, so a test that pinned the ageing and left publication on the wall
 * would compare a seeded month against whatever day the suite happened to run on.
 */
@Injectable()
export class AttestationsWriteService {
  static readonly RESOURCE = "attestation";

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * `POST /api/v1/data/attestations`.
   *
   * 409 when that city's day is already published — the unique key is
   * `(city, month, day)` and re-publishing a day is a second attestation of a
   * figure that is already attested.
   */
  async create(body: AttestationCreate): Promise<AttestationRecord> {
    const row = inserted(
      await write(AttestationsWriteService.RESOURCE, () =>
        this.db
          .insert(financeAttestations)
          .values({
            id: body.id,
            city: body.city,
            month: body.month,
            day: body.day,
            currency: body.currency,
            grossMinor: body.grossMinor,
            costsMinor: body.costsMinor,
            publishedAt: this.clock(),
          })
          .returning(),
      ),
      AttestationsWriteService.RESOURCE,
      body.id,
    );

    // The mapper owns the figures and holds `partial` as its placeholder verdict; the
    // count below is what replaces it, so the record is spread rather than built here.
    return { ...attestationRecord(row), verdict: await this.verdict(row.city, row.month) };
  }

  /**
   * The verdict for this city's month, counted over the table rather than assumed.
   *
   * ## Why a write has to count
   *
   * Because a verdict is a property of a city-month, not of a row, so a record
   * returned by this method has to carry one — and the only way to know whether this
   * write *completed* that month is to ask how many days it now has. Guessing from
   * the body (`day === 31 ? complete : partial`) is wrong twice: February never
   * reaches 31, and publishing the 28th of a 30-day month is the moment it becomes
   * complete.
   *
   * `verdictFor` is the same function `proof/attestations` folds with, so a row that
   * comes back from this `POST` and a row that comes back from the section agree on
   * the same day — the count is the input, and the rule is in one place.
   */
  private async verdict(city: string, month: string): Promise<AttestationRecord["verdict"]> {
    const rows = await this.db
      .select({ id: financeAttestations.id })
      .from(financeAttestations)
      .where(and(eq(financeAttestations.city, city), eq(financeAttestations.month, month)));

    if (rows.length === 0) {
      // The row just inserted is in this table, or the insert threw and never got
      // here — so an empty count is the database disagreeing with a statement it has
      // already acknowledged, which is a fault in this process rather than a bad
      // request. A plain `Error` therefore: it is opaqued to a 500, which is the
      // honest status, where a 422 would send a caller looking for a bad field that
      // is not there.
      throw new Error(`Attestation count came back empty for ${city} ${month}`);
    }

    return verdictFor(rows.length, month);
  }
}
