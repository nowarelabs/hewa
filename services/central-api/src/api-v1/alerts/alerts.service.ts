import { Inject, Injectable } from "@nestjs/common";
import type {
  Alert,
  AlertSeverity,
  CapacityPressure,
  ConsoleEnvelope,
  OutageGroup,
  SecurityEvent,
} from "@hewa/console-types";
import { asc, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { DB, type Database } from "../../db/db.module.js";
import { instant } from "../../db/instant.js";
import { alerts, alertSeverityEnum, infrastructureNodes } from "../../db/schema.js";
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

/**
 * The worst severity in a group, as a rank rather than a name.
 *
 * `min` over the rank and then a lookup, rather than `max` over the name — the
 * alphabet puts `medium` after `low`, so a max over names would report a group of
 * `low` and `medium` alerts as `medium` for the right reason by accident, and a
 * group of `high` and `medium` as `medium` for the wrong one. The rank is the
 * triage order, so `min` is "worst" by definition.
 */
const worstRank = sql<number>`min(${severityRank})`;

/**
 * The name at a rank.
 *
 * PostgreSQL arrays are indexed from **1**, so this subscripts with the rank as it
 * stands. The `- 1` that reads as an off-by-one correction is not a correction: it
 * maps rank 1 (`critical`) onto `array[0]`, which is `NULL`, and every other
 * severity onto the one below it — a group's worst `critical` reported as `null`,
 * its `high` reported as `medium`. It fails silently and plausibly, which is why the
 * mapping is written out here once rather than adjusted at the call site.
 */
const rankToSeverity = sql<AlertSeverity>`(array['critical','high','medium','low']::text[])[${worstRank}]`;

/**
 * The nodes table under a name the join can reach.
 *
 * `alias` rather than a hand-written ``sql`infrastructure_nodes node on …```: the
 * fragment names the table in a string, so drizzle learns nothing about it — the
 * joined columns come back typed as whatever the fragment was cast to, `null` is not
 * inferred for a left join, and the query has no way of knowing the two `node`
 * references are the same table. The alias hands drizzle a real table object, so the
 * nullability of `capacityGbps` comes from the join kind rather than from a cast
 * somebody remembered to write.
 */
const node = alias(infrastructureNodes, "node");

@Injectable()
export class AlertsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * `alerts/feed`: every alert, worst and newest first.
   *
   * Grouped by `severity` and not by `category`. A severity bar is the triage control
   * — "what do I look at next" — and a category bar answers a different question,
   * one an operator asks by filtering rather than by deciding. `category` is on
   * every row, so a panel may use it; only one of them is offered as a chip.
   */
  async readFeed(): Promise<ConsoleEnvelope<Alert[], AlertSeverity>> {
    const rows = await this.readRows();

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
      raisedAt: instant(row.raisedAt),
    }));

    return envelope(raised, alertSeverityEnum.enumValues as AlertSeverity[]);
  }

  /**
   * `alerts/outages`: what is down, grouped so one outage is not four alerts.
   *
   * ## Why this section exists
   *
   * A subsea cable that drops raises an alert per commitment riding on it, per
   * peering session and per customer, and a feed of those hides its own severity
   * behind repetition: the critical one is row two of four identical rows. So this
   * groups by the thing that broke and sums the rest — the count is how much of the
   * same thing, and `worstSeverity` is how bad.
   *
   * `affectedSlas` is the *worst member's* count rather than the sum, and that is
   * deliberate: the same cable counts the same commitments in every alert it
   * raises, so summing counts each affected commitment once per alert that mentions
   * it and inflates a number an operator would use to size an incident.
   *
   * `automatedAction` takes the most severe member's action rather than the last
   * row's, for the same reason: the action that matters is the one attached to the
   * worst alert, and the most recent row is whichever alert happened to sort last.
   */
  async readOutages(): Promise<ConsoleEnvelope<OutageGroup[], AlertSeverity>> {
    const rows = await this.db
      .select({
        entityId: alerts.entityId,
        entityLabel: sql<string>`max(${alerts.entityLabel})`,
        provider: sql<string>`max(${alerts.provider})`,
        city: sql<string>`max(${alerts.city})`,
        lat: sql<number>`max(${alerts.lat})`,
        lng: sql<number>`max(${alerts.lng})`,
        alertCount: sql<number>`count(*)::int`,
        worstSeverity: rankToSeverity,
        // `sum`, because two alerts against the same cable each naming 20 Gbps are
        // 40 Gbps of traffic the operator has to route around.
        impactedGbps: sql<number>`coalesce(sum(${alerts.impactedGbps}), 0)::int`,
        affectedSlas: sql<number>`max(${alerts.affectedSlas})::int`,
        firstRaisedAt: sql<Date | string>`min(${alerts.raisedAt})`,
        lastRaisedAt: sql<Date | string>`max(${alerts.raisedAt})`,
        automatedAction: sql<string | null>`max(${alerts.automatedAction})`,
      })
      .from(alerts)
      .where(sql`${alerts.category} = 'outage'`)
      .groupBy(alerts.entityId)
      // Worst first, then the most traffic affected, then most recent. A reader
      // opening this section is looking for the thing that is down hardest.
      .orderBy(
        asc(worstRank),
        sql`sum(${alerts.impactedGbps}) desc`,
        desc(sql`max(${alerts.raisedAt})`),
      );

    return envelope(
      rows.map((row) => toOutage(row)),
      alertSeverityEnum.enumValues as AlertSeverity[],
    );
  }

  /**
   * `alerts/capacity`: alerts about running out, beside the headroom that is left.
   *
   * ## Why this is a join and not a filter
   *
   * A capacity alert says "this node is at 97%", which is the alert's own account
   * of a figure the nodes table also holds and may now disagree with. Reading the
   * alert beside the node's *current* headroom is what turns "97%" into "97% and
   * rising, 24 Gbps left", and the two numbers must come from one query — read in
   * two, they are two snapshots and the panel would show a node full against a
   * current figure that has since moved.
   *
   * `capacityGbps` and `headroomGbps` are `null` when the alert names an entity that
   * is not one of our nodes — a corridor, a peer's edge. `null` rather than zero,
   * because zero would put the row in a "nodes with room" table as the emptiest
   * entry in it.
   */
  async readCapacity(): Promise<ConsoleEnvelope<CapacityPressure[], AlertSeverity>> {
    const rows = await this.db
      .select({
        entityId: alerts.entityId,
        entityLabel: sql<string>`max(${alerts.entityLabel})`,
        provider: sql<string>`max(${alerts.provider})`,
        city: sql<string>`max(${alerts.city})`,
        alertCount: sql<number>`count(*)::int`,
        worstSeverity: rankToSeverity,
        impactedGbps: sql<number>`coalesce(sum(${alerts.impactedGbps}), 0)::int`,
        capacityGbps: sql<number | null>`max(${node.capacityGbps})`,
        headroomGbps: sql<number | null>`max(
          greatest(${node.capacityGbps} - trunc(${node.utilisationBps}::numeric
            * ${node.capacityGbps} / 10000)::int, 0)
        )`,
        lastRaisedAt: sql<Date | string>`max(${alerts.raisedAt})`,
      })
      .from(alerts)
      // A left join, and the reason is `null`: an alert about something that is not
      // one of our nodes still belongs in this section, with its capacity unknown.
      .leftJoin(node, eq(node.id, alerts.entityId))
      .where(sql`${alerts.category} = 'capacity'`)
      .groupBy(alerts.entityId)
      .orderBy(
        asc(worstRank),
        sql`sum(${alerts.impactedGbps}) desc`,
        desc(sql`max(${alerts.raisedAt})`),
      );

    const pressure: CapacityPressure[] = rows.map((row) => ({
      entityId: row.entityId,
      entityLabel: row.entityLabel,
      provider: row.provider,
      city: row.city,
      alertCount: row.alertCount,
      worstSeverity: row.worstSeverity,
      impactedGbps: row.impactedGbps,
      capacityGbps: row.capacityGbps === null ? null : Number(row.capacityGbps),
      headroomGbps: row.headroomGbps === null ? null : Number(row.headroomGbps),
      lastRaisedAt: instant(row.lastRaisedAt),
    }));

    return envelope(pressure, alertSeverityEnum.enumValues as AlertSeverity[]);
  }

  /**
   * `alerts/security`: who got in, and what was done about it.
   *
   * Grouped by entity for the same reason as the outages: the same intrusion
   * against a provider's edge raises one alert per affected customer, and the
   * operator's question is "how big is this and have we already answered it" — the
   * count and the action, not forty rows saying "unauthorised access".
   *
   * Unlike the outages this is keyed by `entityId` alone rather than by category,
   * because a section is already inside one category and adding it to the grouping
   * key would be a no-op that looks deliberate.
   */
  async readSecurity(): Promise<ConsoleEnvelope<SecurityEvent[], AlertSeverity>> {
    const rows = await this.db
      .select({
        entityId: alerts.entityId,
        entityLabel: sql<string>`max(${alerts.entityLabel})`,
        provider: sql<string>`max(${alerts.provider})`,
        city: sql<string>`max(${alerts.city})`,
        eventCount: sql<number>`count(*)::int`,
        worstSeverity: rankToSeverity,
        lastSeenAt: sql<Date | string>`max(${alerts.raisedAt})`,
        automatedAction: sql<string | null>`max(${alerts.automatedAction})`,
      })
      .from(alerts)
      .where(sql`${alerts.category} = 'security'`)
      .groupBy(alerts.entityId)
      .orderBy(asc(worstRank), desc(sql`max(${alerts.raisedAt})`));

    return envelope(
      rows.map<SecurityEvent>((row) => ({
        entityId: row.entityId,
        entityLabel: row.entityLabel,
        provider: row.provider,
        city: row.city,
        eventCount: row.eventCount,
        worstSeverity: row.worstSeverity,
        lastSeenAt: instant(row.lastSeenAt),
        automatedAction: row.automatedAction,
      })),
      alertSeverityEnum.enumValues as AlertSeverity[],
    );
  }

  /** One ordered read shared by the feed and nothing else — the rest are grouped. */
  private readRows(): Promise<(typeof alerts.$inferSelect)[]> {
    return this.db
      .select()
      .from(alerts)
      .orderBy(asc(severityRank), desc(alerts.raisedAt), asc(alerts.id));
  }
}

function toOutage(row: {
  entityId: string;
  entityLabel: string;
  provider: string;
  city: string;
  lat: number;
  lng: number;
  alertCount: number;
  worstSeverity: AlertSeverity;
  impactedGbps: number;
  affectedSlas: number;
  firstRaisedAt: Date | string;
  lastRaisedAt: Date | string;
  automatedAction: string | null;
}): OutageGroup {
  return {
    entityId: row.entityId,
    entityLabel: row.entityLabel,
    provider: row.provider,
    city: row.city,
    lat: row.lat,
    lng: row.lng,
    alertCount: row.alertCount,
    worstSeverity: row.worstSeverity,
    impactedGbps: row.impactedGbps,
    affectedSlas: row.affectedSlas,
    firstRaisedAt: instant(row.firstRaisedAt),
    lastRaisedAt: instant(row.lastRaisedAt),
    automatedAction: row.automatedAction,
  };
}
