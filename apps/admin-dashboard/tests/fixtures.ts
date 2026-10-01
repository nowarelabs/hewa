import { ResponseCode } from "@hewa/response-codes";
import type { ConsoleSectionKey, ConsolePayload } from "@hewa/console-types";

/**
 * Console payloads for the app's tests, written here and not borrowed.
 *
 * These are deliberately not the service's records. A test that imports the
 * records it is asserting about is asserting that the records are the same as
 * themselves.
 *
 * Two rows per section where relevant, with vocabularies that include groups
 * nothing is on so chips survive when filtered.
 */
export const consoleFixtures = {
  "market/book": {
    code: ResponseCode.Ok,
    data: {
      bestBid: { amountMinor: 5400, currency: "USD" },
      bestOffer: { amountMinor: 880, currency: "USD" },
      committedGbps: 1162,
      openOrders: 2,
      currency: "USD",
      orders: [
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
    meta: { groups: [] as never[] },
  } as ConsolePayload["market/book"],

  "market/prices": {
    code: ResponseCode.Ok,
    data: {
      currency: "USD",
      points: [
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
      latest: [
        {
          pool: "nairobi_ixp",
          price: { amountMinor: 900, currency: "USD" },
          observedAt: "2026-03-26T08:00:00Z",
        },
        {
          pool: "mombasa_corridor",
          price: { amountMinor: 700, currency: "USD" },
          observedAt: "2026-03-26T08:00:00Z",
        },
      ],
      changePct: 2,
    },
    meta: { groups: [] as never[] },
  } as ConsolePayload["market/prices"],

  "market/venues": {
    code: ResponseCode.Ok,
    data: {
      currency: "USD",
      totalCommittedGbps: 1162,
      venues: [
        { pool: "nairobi_ixp", committedGbps: 500, share: 65 },
        { pool: "mombasa_corridor", committedGbps: 200, share: 35 },
      ],
    },
    meta: { groups: [] as never[] },
  } as ConsolePayload["market/venues"],

  "infrastructure/nodes": {
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
    meta: {
      groups: ["data_center", "metro_fiber", "long_haul_fiber", "ixp", "subsea_cable", "cdn_edge"],
    },
  } as ConsolePayload["infrastructure/nodes"],

  "infrastructure/headroom": {
    code: ResponseCode.Ok,
    data: [
      {
        nodeId: "n1",
        name: "Nairobi IXP",
        kind: "ixp",
        provider: "Kenya Exchange",
        city: "Nairobi",
        country: "Kenya",
        capacityGbps: 800,
        committedGbps: 790,
        headroomGbps: 10,
        utilisationBps: 9875,
        status: "operational",
        observedAt: "2026-03-26T08:00:00Z",
      },
      {
        nodeId: "n2",
        name: "Mombasa Cable Landing",
        kind: "subsea_cable",
        provider: "SEACOM",
        city: "Mombasa",
        country: "Kenya",
        capacityGbps: 1200,
        committedGbps: 505,
        headroomGbps: 695,
        utilisationBps: 4210,
        status: "degraded",
        observedAt: "2026-03-26T08:00:00Z",
      },
    ],
    meta: {
      groups: ["data_center", "metro_fiber", "long_haul_fiber", "ixp", "subsea_cable", "cdn_edge"],
    },
  } as ConsolePayload["infrastructure/headroom"],

  "infrastructure/providers": {
    code: ResponseCode.Ok,
    data: [
      {
        provider: "Kenya Exchange",
        nodeCount: 1,
        kinds: ["ixp"],
        countries: ["Kenya"],
        capacityGbps: 800,
        committedGbps: 790,
        utilisationBps: 9875,
        impaired: 0,
      },
      {
        provider: "SEACOM",
        nodeCount: 1,
        kinds: ["subsea_cable"],
        countries: ["Kenya"],
        capacityGbps: 1200,
        committedGbps: 505,
        utilisationBps: 4210,
        impaired: 1,
      },
    ],
    meta: { groups: [] as never[] },
  } as ConsolePayload["infrastructure/providers"],

  "settlement/movements": {
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
    meta: { groups: ["clearing", "micro_payment", "escrow", "payout"] },
  } as ConsolePayload["settlement/movements"],

  "settlement/runs": {
    code: ResponseCode.Ok,
    data: [
      {
        batch: "run-2026-03-26",
        currency: "USD",
        kinds: ["clearing", "payout"],
        lineCount: 2,
        failed: 1,
        gross: { amountMinor: -167000, currency: "USD" },
        fees: { amountMinor: 1460, currency: "USD" },
        net: { amountMinor: -165540, currency: "USD" },
        startedAt: "2026-03-26T05:55:00Z",
        completedAt: "2026-03-26T06:10:00Z",
      },
    ],
    meta: { groups: [] as never[] },
  } as ConsolePayload["settlement/runs"],

  "settlement/payouts": {
    code: ResponseCode.Ok,
    data: [
      {
        id: "p1",
        batch: "run-2026-03-26",
        counterparty: "Provider B",
        amount: { amountMinor: -42000, currency: "USD" },
        fee: { amountMinor: 210, currency: "USD" },
        net: { amountMinor: -41790, currency: "USD" },
        status: "failed",
        occurredAt: "2026-03-26T06:05:00Z",
        failureReason: "Wallet rejected the payout",
      },
    ],
    meta: { groups: ["pending", "processing", "completed", "failed", "reversed"] },
  } as ConsolePayload["settlement/payouts"],

  "slas/commitments": {
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
  } as ConsolePayload["slas/commitments"],

  "slas/at_risk": {
    code: ResponseCode.Ok,
    data: [
      {
        id: "q2",
        account: "Beta ISP",
        nodeId: "n2",
        nodeName: "Mombasa Cable Landing",
        provider: "SEACOM",
        state: "breached",
        sla: { targetBps: 9995, actualBps: 9820, creditNumerator: 1, creditDenominator: 20 },
        shortfallBps: 175,
        trendBps: 25,
        measuredAt: "2026-03-26T08:00:00Z",
      },
    ],
    meta: { groups: ["compliant", "at_risk", "breached"] },
  } as ConsolePayload["slas/at_risk"],

  "slas/credits": {
    code: ResponseCode.Ok,
    data: [
      {
        commitmentId: "q2",
        account: "Beta ISP",
        nodeName: "Mombasa Cable Landing",
        provider: "SEACOM",
        state: "breached",
        targetBps: 9995,
        actualBps: 9820,
        creditablePoints: 1,
        creditNumerator: 1,
        creditDenominator: 20,
        measuredAt: "2026-03-26T08:00:00Z",
      },
    ],
    meta: { groups: ["compliant", "at_risk", "breached"] },
  } as ConsolePayload["slas/credits"],

  "alerts/feed": {
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
  } as ConsolePayload["alerts/feed"],

  "alerts/outages": {
    code: ResponseCode.Ok,
    data: [
      {
        entityId: "n2",
        entityLabel: "Mombasa Cable Landing",
        provider: "SEACOM",
        city: "Mombasa",
        lat: -4.0435,
        lng: 39.6682,
        alertCount: 1,
        worstSeverity: "high",
        impactedGbps: 210,
        affectedSlas: 3,
        firstRaisedAt: "2026-03-26T08:00:00Z",
        lastRaisedAt: "2026-03-26T08:00:00Z",
        automatedAction: "Failover path enabled",
      },
    ],
    meta: { groups: ["critical", "high", "medium", "low"] },
  } as ConsolePayload["alerts/outages"],

  "alerts/capacity": {
    code: ResponseCode.Ok,
    data: [
      {
        entityId: "n2",
        entityLabel: "Mombasa Cable Landing",
        provider: "SEACOM",
        city: "Mombasa",
        alertCount: 1,
        worstSeverity: "high",
        impactedGbps: 210,
        capacityGbps: 1200,
        headroomGbps: 695,
        lastRaisedAt: "2026-03-26T08:00:00Z",
      },
    ],
    meta: { groups: ["critical", "high", "medium", "low"] },
  } as ConsolePayload["alerts/capacity"],

  "alerts/security": {
    code: ResponseCode.Ok,
    data: [
      {
        entityId: "edge-1",
        entityLabel: "Edge gateway",
        provider: "SEACOM",
        city: "Nairobi",
        eventCount: 1,
        worstSeverity: "medium",
        lastSeenAt: "2026-03-26T07:50:00Z",
        automatedAction: null,
      },
    ],
    meta: { groups: ["critical", "high", "medium", "low"] },
  } as ConsolePayload["alerts/security"],
} satisfies { [K in ConsoleSectionKey]: ConsolePayload[K] };
