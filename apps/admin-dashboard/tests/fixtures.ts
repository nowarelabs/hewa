import { ResponseCode } from "@hewa/response-codes";
import type { ConsoleEnvelope, ConsoleViewKey } from "@hewa/console-types";

/**
 * Console payloads for the app's tests, written here and not borrowed.
 *
 * These are deliberately not the service's records. A test that imports the
 * records it is asserting about is asserting that the records are the same as
 * themselves, and if it did, then adding a node to the service would move every
 * count in this suite — so a data change would look like a UI change and the
 * person reading the failure would be sent to the wrong file.
 *
 * Two rows per view is enough to make a filter do something. They are short and
 * ugly on purpose: nothing here is read by eye, only counted and filtered.
 *
 * Every view carries a group that no row is on, because "a chip the bar offers
 * that nothing is on" is a state the chips have to survive, and a fixture in
 * which every group is populated never puts it on screen.
 */
export const consoleFixtures = {
  market: {
    code: ResponseCode.Ok,
    data: {
      bestBid: { amountMinor: 540000, currency: "USD" },
      bestOffer: { amountMinor: 88000, currency: "USD" },
      committedGbps: 1162,
      openOrders: 2,
      currency: "USD",
      priceSeries: [
        {
          pool: "nairobi_ixp",
          at: "2026-03-26T08:00:00Z",
          price: { amountMinor: 900, currency: "USD" },
        },
        {
          pool: "mombasa_corridor",
          at: "2026-03-26T08:00:00Z",
          price: { amountMinor: 700, currency: "USD" },
        },
      ],
      venues: [
        { pool: "nairobi_ixp", share: 65 },
        { pool: "mombasa_corridor", share: 35 },
        { pool: "east_africa_subsea", share: 0 },
        { pool: "cdn_edge", share: 0 },
      ],
      // A section per pool, because the rail has a tab per pool and a tab with no
      // section behind it is a tab that opens an empty panel. The two pools with
      // nothing on them carry figures rather than blanks: the service derives a
      // section for every pool it can hold, and a section with no figures would be
      // a second way of saying "no rows", which the rail selection already says.
      sections: [
        {
          id: "nairobi_ixp",
          title: "Nairobi IXP",
          figures: [{ label: "Best bid", value: "5,400.00 USD" }],
        },
        {
          id: "mombasa_corridor",
          title: "Mombasa corridor",
          figures: [{ label: "Best offer", value: "880.00 USD" }],
        },
        {
          id: "east_africa_subsea",
          title: "East Africa subsea",
          figures: [{ label: "Best bid", value: "No bids" }],
        },
        {
          id: "cdn_edge",
          title: "CDN edge",
          figures: [{ label: "Best offer", value: "No offers" }],
        },
      ],
      book: [
        {
          id: "o1",
          pool: "nairobi_ixp",
          side: "bid",
          provider: "Provider A",
          committedGbps: 500,
          burstGbps: 600,
          unitPrice: { amountMinor: 5400, currency: "USD" },
          submittedAt: "2026-03-26T07:00:00Z",
        },
        {
          id: "o2",
          pool: "mombasa_corridor",
          side: "offer",
          provider: "Provider B",
          committedGbps: 200,
          burstGbps: 250,
          unitPrice: { amountMinor: 880, currency: "USD" },
          submittedAt: "2026-03-26T07:30:00Z",
        },
      ],
    },
    // A document, not a list: it groups by nothing and takes no chip bar.
    meta: { groups: [] },
  },

  infrastructure: {
    code: ResponseCode.Ok,
    data: [
      {
        id: "n1",
        name: "Nairobi IXP",
        kind: "ixp",
        provider: "Kenya Exchange",
        city: "Nairobi",
        country: "Kenya",
        lat: -1.2921,
        lng: 36.8219,
        capacityGbps: 800,
        utilisationBps: 9875,
        status: "operational",
        observedAt: "2026-03-26T08:00:00Z",
      },
      {
        id: "n2",
        name: "Mombasa Cable Landing",
        kind: "subsea_cable",
        provider: "SEACOM",
        city: "Mombasa",
        country: "Kenya",
        lat: -4.0435,
        lng: 39.6682,
        capacityGbps: 1200,
        utilisationBps: 4210,
        status: "degraded",
        observedAt: "2026-03-26T08:00:00Z",
      },
    ],
    // Every kind, none of them empty here, so the bar's chips come from the
    // service's vocabulary rather than from the rows.
    meta: {
      groups: ["data_center", "metro_fiber", "long_haul_fiber", "ixp", "subsea_cable", "cdn_edge"],
    },
  },

  settlement: {
    code: ResponseCode.Ok,
    data: [
      {
        id: "s1",
        batch: "run-2026-03-26",
        kind: "clearing",
        status: "completed",
        counterparty: "Provider A",
        amount: { amountMinor: -125000, currency: "USD" },
        fee: { amountMinor: 1250, currency: "USD" },
        occurredAt: "2026-03-26T06:00:00Z",
        failureReason: null,
      },
      {
        id: "s2",
        batch: "run-2026-03-26",
        kind: "payout",
        status: "failed",
        counterparty: "Provider B",
        amount: { amountMinor: -42000, currency: "USD" },
        fee: { amountMinor: 210, currency: "USD" },
        occurredAt: "2026-03-26T06:05:00Z",
        failureReason: "Wallet rejected the payout",
      },
    ],
    // `escrow` is a kind the bar offers and nothing is on: the state a chip has to
    // survive.
    meta: { groups: ["clearing", "micro_payment", "escrow", "payout"] },
  },

  slas: {
    code: ResponseCode.Ok,
    data: [
      {
        id: "q1",
        account: "Acme ISP",
        nodeId: "n1",
        nodeName: "Nairobi IXP",
        provider: "Kenya Exchange",
        sla: { targetBps: 9995, actualBps: 9998, creditNumerator: 1, creditDenominator: 20 },
        packetLossPpm: 120,
        latencyP95Ms: 4,
        state: "compliant",
        measuredAt: "2026-03-26T08:00:00Z",
      },
      {
        id: "q2",
        account: "Beta ISP",
        nodeId: "n2",
        nodeName: "Mombasa Cable Landing",
        provider: "SEACOM",
        sla: { targetBps: 9995, actualBps: 9820, creditNumerator: 1, creditDenominator: 20 },
        packetLossPpm: 3400,
        latencyP95Ms: 38,
        state: "breached",
        measuredAt: "2026-03-26T08:00:00Z",
      },
    ],
    meta: { groups: ["compliant", "at_risk", "breached"] },
  },

  alerts: {
    code: ResponseCode.Ok,
    data: [
      {
        id: "a1",
        title: "Subsea corridor over capacity",
        description: "Utilisation up 45 points on the primary path, failover engaged.",
        category: "capacity",
        severity: "high",
        entityId: "n2",
        entityLabel: "Mombasa Cable Landing",
        provider: "SEACOM",
        city: "Mombasa",
        lat: -4.0435,
        lng: 39.6682,
        impactedGbps: 210,
        affectedSlas: 3,
        automatedAction: "Failover path enabled",
        raisedAt: "2026-03-26T08:00:00Z",
      },
      {
        id: "a2",
        title: "Settlement run short",
        description: "Batch run-2026-03-26 is short by 4,200 minor units.",
        category: "billing",
        severity: "critical",
        entityId: "s2",
        entityLabel: "run-2026-03-26",
        provider: "Provider B",
        city: "Mombasa",
        lat: -4.0435,
        lng: 39.6682,
        impactedGbps: 0,
        affectedSlas: 0,
        automatedAction: null,
        raisedAt: "2026-03-26T06:05:00Z",
      },
    ],
    meta: { groups: ["critical", "high", "medium", "low"] },
  },
} satisfies { [K in ConsoleViewKey]: ConsoleEnvelope<unknown, string> };
