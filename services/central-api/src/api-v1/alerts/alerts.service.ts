import { Inject, Injectable } from "@nestjs/common";
import type { Alert, AlertSeverity, ConsoleEnvelope } from "@hewa/console-types";
import { asc, desc, sql } from "drizzle-orm";

import { DB, type Database } from "../../db/db.module.js";
import { alerts, alertSeverityEnum } from "../../db/schema.js";
import { envelope } from "../envelope.js";

/**
 * Severity as a position in the triage order, best first.
 *
 * `array_position` rather than a `case` expression: a `case` needs its branches as
 * SQL text, and a `sql` template parameterises every value handed to it, so the
 * branches would have to be `sql.raw`'d one by one to stop the severity names being
 * sent as bind parameters — an index full of `case` for a four-value vocabulary.
 *
 * The array is the order `meta.groups` is built from and it is *not* alphabetical:
 * `critical, high, low, medium` would put the quietest alert first. `array_position`
 * counts from 1, so the worst severity is the smallest number and the sort below is
 * ascending — which reads backwards, and is why this is a named fragment rather than
 * a `desc(...)` on the column. This is the one statement of what severity means for
 * ordering, and it lives here rather than in the panel so the first row is the same
 * row on every surface that asks this service.
 */
const severityRank = sql<number>`array_position(array['critical','high','medium','low']::text[], ${alerts.severity}::text)`;

@Injectable()
export class AlertsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Every alert, worst and newest first.
   *
   * Grouped by `severity` and not by `category`. A severity bar is the triage control
   * — "what do I look at next" — and a category bar answers a different question,
   * one an operator asks by filtering rather than by deciding. `category` is on
   * every row, so a panel may use it; only one of them is offered as a chip.
   */
  async read(): Promise<ConsoleEnvelope<Alert[], AlertSeverity>> {
    const rows = await this.db
      .select()
      .from(alerts)
      .orderBy(asc(severityRank), desc(alerts.raisedAt), asc(alerts.id));

    const raised: Alert[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      severity: row.severity,
      entityId: row.entityId,
      entityLabel: row.entityLabel,
      provider: row.provider,
      city: row.city,
      lat: row.lat,
      lng: row.lng,
      impactedGbps: row.impactedGbps,
      affectedSlas: row.affectedSlas,
      // `null` when nothing acted, which the panel renders as a dash and not as an
      // empty sentence — "we did not act" and "we acted, blankly" are different
      // facts and only one of them should ever read as a dash.
      automatedAction: row.automatedAction,
      raisedAt: row.raisedAt.toISOString(),
    }));

    return envelope(raised, alertSeverityEnum.enumValues as AlertSeverity[]);
  }
}
