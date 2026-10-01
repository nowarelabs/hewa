/**
 * The database, and what goes in it.
 *
 * ## Why the seed is a function and not a script
 *
 * Because the same rows have to arrive two ways: a developer running
 * `pnpm db:seed` against a local PostgreSQL, and a test booting PGlite in memory.
 * A script that could only be run from a shell would leave the e2e tests either
 * talking to a developer's real database — so they fail on a machine that happens
 * to have one and pass on a machine that does not — or asserting against nothing at
 * all. `seedDatabase` takes a connection, so both callers get the identical rows and
 * the tests are hermetic by construction rather than by discipline.
 *
 * ## Why the rows are fixed
 *
 * No clock and no randomness. Every timestamp is an offset from {@link EPOCH} and
 * every figure is written out, so a failing assertion names one row rather than a
 * moving target, and a snapshot of the console is reproducible. A seed that calls
 * `Date.now()` is a seed that can only ever be read once.
 *
 * ## Why `state` is computed rather than written
 *
 * Each SLA row's `state` column is filled in by `slaState` from
 * `@hewa/marketplace-types`, the same function a settlement run uses to decide a
 * credit. Writing the three values out by hand would make it possible for the seed
 * and the rule to disagree, and then the seeded database would be a place where a
 * commitment is "compliant" that the billing code calls breached.
 */
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { slaCommitment, slaState } from "@hewa/marketplace-types";

import { loadEnv } from "../config/env.js";
import { loadLocalEnv } from "../config/local-env.js";
import type { Database } from "./db.module.js";
import * as schema from "./schema.js";

/**
 * 2026-02-01T00:00:00Z. Every timestamp below is this plus a fixed number of
 * minutes, so the oldest row in the database is also the oldest one in the file.
 */
const EPOCH = Date.parse("2026-02-01T00:00:00.000Z");

const MINUTE = 60_000;

/** `EPOCH` plus whole minutes, so the fixture reads as "twelve minutes in". */
const at = (minutes: number): Date => new Date(EPOCH + minutes * MINUTE);

const ORDERS = [
  {
    id: "ord-0001",
    pool: "nairobi_ixp",
    side: "bid",
    provider: "Sokowango Fiber",
    committedGbps: 40,
    burstGbps: 50,
    priceMinor: 412_000,
    submittedAt: at(4),
  },
  {
    id: "ord-0002",
    pool: "nairobi_ixp",
    side: "bid",
    provider: "Coastal Broadband",
    committedGbps: 25,
    burstGbps: 25,
    priceMinor: 398_000,
    submittedAt: at(7),
  },
  {
    id: "ord-0003",
    pool: "nairobi_ixp",
    side: "offer",
    provider: "Equinix Nairobi",
    committedGbps: 100,
    burstGbps: 150,
    priceMinor: 385_000,
    submittedAt: at(2),
  },
  {
    id: "ord-0004",
    pool: "nairobi_ixp",
    side: "offer",
    provider: "Africa Data Centres",
    committedGbps: 60,
    burstGbps: 80,
    priceMinor: 372_000,
    submittedAt: at(9),
  },
  {
    id: "ord-0005",
    pool: "mombasa_corridor",
    side: "bid",
    provider: "Sokowango Fiber",
    committedGbps: 30,
    burstGbps: 40,
    priceMinor: 540_000,
    submittedAt: at(11),
  },
  {
    id: "ord-0006",
    pool: "mombasa_corridor",
    side: "offer",
    provider: "Seacom",
    committedGbps: 80,
    burstGbps: 120,
    priceMinor: 515_000,
    submittedAt: at(5),
  },
  {
    id: "ord-0007",
    pool: "east_africa_subsea",
    side: "bid",
    provider: "Airtel Business",
    committedGbps: 200,
    burstGbps: 260,
    priceMinor: 288_000,
    submittedAt: at(6),
  },
  {
    id: "ord-0008",
    pool: "east_africa_subsea",
    side: "offer",
    provider: "SEACOM",
    committedGbps: 400,
    burstGbps: 520,
    priceMinor: 274_000,
    submittedAt: at(1),
  },
  {
    id: "ord-0009",
    pool: "east_africa_subsea",
    side: "offer",
    provider: "Liquid Telecom",
    committedGbps: 150,
    burstGbps: 200,
    priceMinor: 261_000,
    submittedAt: at(8),
  },
  {
    id: "ord-0010",
    pool: "cdn_edge",
    side: "bid",
    provider: "Hurricane Electric",
    committedGbps: 12,
    burstGbps: 20,
    priceMinor: 96_000,
    submittedAt: at(3),
  },
  {
    id: "ord-0011",
    pool: "cdn_edge",
    side: "offer",
    provider: "Cloudflare",
    committedGbps: 45,
    burstGbps: 60,
    priceMinor: 88_000,
    submittedAt: at(6),
  },
  {
    id: "ord-0012",
    pool: "cdn_edge",
    side: "offer",
    provider: "Akamai",
    committedGbps: 20,
    burstGbps: 30,
    priceMinor: 91_000,
    submittedAt: at(12),
  },
] as const;

/**
 * A price walk, so the chart has a shape rather than a line.
 *
 * `bias` is cents per observation and `swing` its amplitude, and the index is what
 * varies the price within each band — a sine over a quarter of a cycle, which gives
 * four points of rise and four of fall. Written as a generator so a pool's series is
 * stated once and the number of observations is a single argument.
 */
function* priceWalk(startMinor: number, bias: number, swing: number): Generator<number> {
  for (let step = 0; step < 48; step += 1) {
    yield startMinor + bias * step + Math.round(swing * Math.sin((step / 8) * Math.PI));
  }
}

const SPOT_POOLS = [
  { pool: "nairobi_ixp", startMinor: 372_000, bias: 180, swing: 2_400 },
  { pool: "mombasa_corridor", startMinor: 515_000, bias: 260, swing: 3_100 },
  { pool: "east_africa_subsea", startMinor: 261_000, bias: -90, swing: 2_800 },
  { pool: "cdn_edge", startMinor: 88_000, bias: 40, swing: 900 },
] as const;

const NODES = [
  {
    id: "nod-nbo-01",
    name: "Equinix Nairobi",
    kind: "data_center",
    provider: "Equinix",
    city: "Nairobi",
    country: "Kenya",
    lat: -1.3192,
    lng: 36.9278,
    capacityGbps: 800,
    utilisationBps: 6_420,
    status: "operational",
    observedAt: at(15),
  },
  {
    id: "nod-nbo-02",
    name: "Africa Data Centres Nairobi",
    kind: "data_center",
    provider: "Africa Data Centres",
    city: "Nairobi",
    country: "Kenya",
    lat: -1.3052,
    lng: 36.8146,
    capacityGbps: 600,
    utilisationBps: 9_105,
    status: "degraded",
    observedAt: at(15),
  },
  {
    id: "nod-nbo-ix",
    name: "Kenya IXP",
    kind: "ixp",
    provider: "KIXP",
    city: "Nairobi",
    country: "Kenya",
    lat: -1.2921,
    lng: 36.8013,
    capacityGbps: 1_200,
    utilisationBps: 4_988,
    status: "operational",
    observedAt: at(15),
  },
  {
    id: "nod-mba-01",
    name: "Seacom Mombasa Landing",
    kind: "subsea_cable",
    provider: "Seacom",
    city: "Mombasa",
    country: "Kenya",
    lat: -4.0435,
    lng: 39.6682,
    capacityGbps: 2_400,
    utilisationBps: 3_210,
    status: "operational",
    observedAt: at(14),
  },
  {
    id: "nod-mba-02",
    name: "Mombasa Metro Ring",
    kind: "metro_fiber",
    provider: "Sokowango Fiber",
    city: "Mombasa",
    country: "Kenya",
    lat: -4.0353,
    lng: 39.6192,
    capacityGbps: 320,
    utilisationBps: 9_640,
    status: "maintenance",
    observedAt: at(14),
  },
  {
    id: "nod-nbo-mba",
    name: "Nairobi–Mombasa Long Haul",
    kind: "long_haul_fiber",
    provider: "Liquid Telecom",
    city: "Voi",
    country: "Kenya",
    lat: -3.3946,
    lng: 38.5581,
    capacityGbps: 900,
    utilisationBps: 9_870,
    status: "degraded",
    observedAt: at(16),
  },
  {
    id: "nod-dar-01",
    name: "Dar es Salaam DC",
    kind: "data_center",
    provider: "Vodacom Tanzania",
    city: "Dar es Salaam",
    country: "Tanzania",
    lat: -6.7924,
    lng: 39.2083,
    capacityGbps: 700,
    utilisationBps: 5_010,
    status: "operational",
    observedAt: at(13),
  },
  {
    id: "nod-cml-01",
    name: "Djibouti Edge",
    kind: "cdn_edge",
    provider: "Cloudflare",
    city: "Djibouti",
    country: "Djibouti",
    lat: 11.5721,
    lng: 43.1456,
    capacityGbps: 240,
    utilisationBps: 2_804,
    status: "operational",
    observedAt: at(13),
  },
  {
    id: "nod-nbo-cdn",
    name: "Nairobi CDN PoP",
    kind: "cdn_edge",
    provider: "Akamai",
    city: "Nairobi",
    country: "Kenya",
    lat: -1.2864,
    lng: 36.8172,
    capacityGbps: 180,
    utilisationBps: 10_000,
    status: "offline",
    observedAt: at(17),
  },
  {
    id: "nod-kig-01",
    name: "Kigali Interconnect",
    kind: "ixp",
    provider: "RCS",
    city: "Kigali",
    country: "Rwanda",
    lat: -1.9441,
    lng: 30.0619,
    capacityGbps: 150,
    utilisationBps: 3_330,
    status: "operational",
    observedAt: at(12),
  },
] as const;

const SETTLEMENTS = [
  {
    id: "stl-0001",
    batch: "2026-02-daily-01",
    kind: "clearing",
    status: "completed",
    counterparty: "Equinix Nairobi",
    amountMinor: 1_284_500_00,
    feeMinor: 19_267_50,
    occurredAt: at(30),
    failureReason: null,
  },
  {
    id: "stl-0002",
    batch: "2026-02-daily-01",
    kind: "clearing",
    status: "completed",
    counterparty: "SEACOM",
    amountMinor: 2_960_000_00,
    feeMinor: 44_400_00,
    occurredAt: at(30),
    failureReason: null,
  },
  {
    id: "stl-0003",
    batch: "2026-02-daily-02",
    kind: "clearing",
    status: "failed",
    counterparty: "Liquid Telecom",
    amountMinor: 640_000_00,
    feeMinor: 9_600_00,
    occurredAt: at(1_455),
    failureReason: "Beneficiary account unreachable: return code 54 on transfer.",
  },
  {
    id: "stl-0004",
    batch: "2026-02-daily-02",
    kind: "clearing",
    status: "completed",
    counterparty: "Cloudflare",
    amountMinor: 318_400_00,
    feeMinor: 4_776_00,
    occurredAt: at(1_455),
    failureReason: null,
  },
  {
    id: "stl-0005",
    batch: "2026-02-daily-02",
    kind: "micro_payment",
    status: "completed",
    counterparty: "Sokowango Fiber",
    amountMinor: 41_200_00,
    feeMinor: 618_00,
    occurredAt: at(1_460),
    failureReason: null,
  },
  {
    id: "stl-0006",
    batch: "2026-02-daily-02",
    kind: "micro_payment",
    status: "processing",
    counterparty: "Coastal Broadband",
    amountMinor: 12_050_00,
    feeMinor: 181_00,
    occurredAt: at(1_462),
    failureReason: null,
  },
  {
    id: "stl-0007",
    batch: "2026-02-daily-02",
    kind: "micro_payment",
    status: "reversed",
    counterparty: "Airtel Business",
    amountMinor: 8_900_00,
    feeMinor: 134_00,
    occurredAt: at(1_470),
    failureReason: "Buyer cancelled the flow; the charge was returned.",
  },
  {
    id: "stl-0008",
    batch: "2026-02-esc-01",
    kind: "escrow",
    status: "completed",
    counterparty: "Equinix Nairobi",
    amountMinor: 5_000_000_00,
    feeMinor: 0,
    occurredAt: at(2_880),
    failureReason: null,
  },
  {
    id: "stl-0009",
    batch: "2026-02-esc-02",
    kind: "escrow",
    status: "pending",
    counterparty: "Africa Data Centres",
    amountMinor: 1_250_000_00,
    feeMinor: 0,
    occurredAt: at(2_880),
    failureReason: null,
  },
  {
    id: "stl-0010",
    batch: "2026-01-payout-01",
    kind: "payout",
    status: "completed",
    counterparty: "Seacom",
    amountMinor: -1_820_400_00,
    feeMinor: 27_306_00,
    occurredAt: at(-20_160),
    failureReason: null,
  },
  {
    id: "stl-0011",
    batch: "2026-01-payout-01",
    kind: "payout",
    status: "completed",
    counterparty: "Liquid Telecom",
    amountMinor: -960_000_00,
    feeMinor: 14_400_00,
    occurredAt: at(-20_160),
    failureReason: null,
  },
  {
    id: "stl-0012",
    batch: "2026-01-payout-02",
    kind: "payout",
    status: "failed",
    counterparty: "Sokowango Fiber",
    amountMinor: -415_000_00,
    feeMinor: 6_225_00,
    occurredAt: at(-19_440),
    failureReason: "Wallet address rejected: chain id 8453 not supported on the payout rail.",
  },
] as const;

/**
 * The commitments, with the two figures the state is computed from.
 *
 * `target`/`actual` in basis points, and the pairs are chosen to sit either side of
 * `AT_RISK_BPS` of shortfall so the view has a row in each state — including a
 * commitment at exactly one hundred basis points short, which is the boundary
 * `slaState` exists to get right and the reason the seeded database is worth having.
 */
const SLAS = [
  {
    id: "sla-0001",
    account: "Coastal Broadband",
    nodeId: "nod-nbo-mba",
    nodeName: "Nairobi–Mombasa Long Haul",
    provider: "Liquid Telecom",
    target: 9_995,
    actual: 9_870,
    creditNumerator: 1,
    creditDenominator: 20,
    packetLossPpm: 4_100,
    latencyP95Ms: 41,
    measuredAt: at(20),
  },
  {
    id: "sla-0002",
    account: "Airtel Business",
    nodeId: "nod-nbo-mba",
    nodeName: "Nairobi–Mombasa Long Haul",
    provider: "Liquid Telecom",
    target: 9_990,
    actual: 9_880,
    creditNumerator: 1,
    creditDenominator: 20,
    packetLossPpm: 3_400,
    latencyP95Ms: 39,
    measuredAt: at(20),
  },
  {
    id: "sla-0003",
    account: "Hurricane Electric",
    nodeId: "nod-nbo-cdn",
    nodeName: "Nairobi CDN PoP",
    provider: "Akamai",
    target: 9_999,
    actual: 0,
    creditNumerator: 1,
    creditDenominator: 10,
    packetLossPpm: 1_000_000,
    latencyP95Ms: 0,
    measuredAt: at(21),
  },
  {
    id: "sla-0004",
    account: "Sokowango Fiber",
    nodeId: "nod-mba-02",
    nodeName: "Mombasa Metro Ring",
    provider: "Sokowango Fiber",
    target: 9_950,
    actual: 9_902,
    creditNumerator: 1,
    creditDenominator: 25,
    packetLossPpm: 1_800,
    latencyP95Ms: 12,
    measuredAt: at(22),
  },
  {
    id: "sla-0005",
    account: "Vodacom Tanzania",
    nodeId: "nod-dar-01",
    nodeName: "Dar es Salaam DC",
    provider: "Vodacom Tanzania",
    target: 9_990,
    actual: 9_985,
    creditNumerator: 1,
    creditDenominator: 20,
    packetLossPpm: 620,
    latencyP95Ms: 28,
    measuredAt: at(19),
  },
  {
    id: "sla-0006",
    account: "RCS Rwanda",
    nodeId: "nod-kig-01",
    nodeName: "Kigali Interconnect",
    provider: "RCS",
    target: 9_500,
    actual: 9_490,
    creditNumerator: 1,
    creditDenominator: 50,
    packetLossPpm: 2_400,
    latencyP95Ms: 33,
    measuredAt: at(18),
  },
  {
    id: "sla-0007",
    account: "Africa Data Centres",
    nodeId: "nod-nbo-02",
    nodeName: "Africa Data Centres Nairobi",
    provider: "Africa Data Centres",
    target: 9_995,
    actual: 9_900,
    creditNumerator: 1,
    creditDenominator: 20,
    packetLossPpm: 9_400,
    latencyP95Ms: 8,
    measuredAt: at(23),
  },
  {
    id: "sla-0008",
    account: "Cloudflare",
    nodeId: "nod-cml-01",
    nodeName: "Djibouti Edge",
    provider: "Cloudflare",
    target: 9_999,
    actual: 9_998,
    creditNumerator: 1,
    creditDenominator: 10,
    packetLossPpm: 90,
    latencyP95Ms: 19,
    measuredAt: at(17),
  },
  {
    id: "sla-0009",
    account: "Equinix Nairobi",
    nodeId: "nod-nbo-01",
    nodeName: "Equinix Nairobi",
    provider: "Equinix",
    target: 9_990,
    actual: 9_990,
    creditNumerator: 1,
    creditDenominator: 20,
    packetLossPpm: 40,
    latencyP95Ms: 3,
    measuredAt: at(24),
  },
] as const;

const ALERTS = [
  {
    id: "alt-0001",
    title: "Nairobi CDN PoP offline",
    description:
      "Up 100% of committed capacity unreachable, 20 Gbps affected. Traffic failed over to Djibouti edge.",
    category: "outage",
    severity: "critical",
    entityId: "nod-nbo-cdn",
    entityLabel: "Nairobi CDN PoP",
    provider: "Akamai",
    city: "Nairobi",
    lat: -1.2864,
    lng: 36.8172,
    impactedGbps: 20,
    affectedSlas: 1,
    automatedAction: "Failed over 20 Gbps to Cloudflare Djibouti; Akamai ticket 88213 open.",
    raisedAt: at(18),
  },
  {
    id: "alt-0002",
    title: "Long-haul route over budget",
    description: "Utilisation at 98.7% against 90 Gbps installed. Two carriers have bids on it.",
    category: "capacity",
    severity: "high",
    entityId: "nod-nbo-mba",
    entityLabel: "Nairobi–Mombasa Long Haul",
    provider: "Liquid Telecom",
    city: "Voi",
    lat: -3.3946,
    lng: 38.5581,
    impactedGbps: 90,
    affectedSlas: 2,
    automatedAction: null,
    raisedAt: at(17),
  },
  {
    id: "alt-0003",
    title: "Two commitments breached on the long-haul route",
    description:
      "Shortfall of 125 bps and 110 bps against a 9,990 bps target. Credits accrue from this run.",
    category: "sla",
    severity: "high",
    entityId: "nod-nbo-mba",
    entityLabel: "Nairobi–Mombasa Long Haul",
    provider: "Liquid Telecom",
    city: "Voi",
    lat: -3.3946,
    lng: 38.5581,
    impactedGbps: 55,
    affectedSlas: 2,
    automatedAction: "Credit lines raised in batch 2026-02-daily-03.",
    raisedAt: at(21),
  },
  {
    id: "alt-0004",
    title: "Clearing run failed",
    description:
      "Beneficiary unreachable on 640,000.00 USD. 19,000 returned to the escrow balance.",
    category: "billing",
    severity: "high",
    entityId: "stl-0003",
    entityLabel: "2026-02-daily-02 clearing",
    provider: "Liquid Telecom",
    city: "Nairobi",
    lat: -1.3192,
    lng: 36.9278,
    impactedGbps: 0,
    affectedSlas: 0,
    automatedAction: "Retry scheduled for the next daily run.",
    raisedAt: at(1_456),
  },
  {
    id: "alt-0005",
    title: "Mombasa metro ring in maintenance window",
    description: "Planned works until 04:00 EAT. Utilisation at 96.4% of a 320 Gbps ring.",
    category: "outage",
    severity: "medium",
    entityId: "nod-mba-02",
    entityLabel: "Mombasa Metro Ring",
    provider: "Sokowango Fiber",
    city: "Mombasa",
    lat: -4.0353,
    lng: 39.6192,
    impactedGbps: 320,
    affectedSlas: 1,
    automatedAction: "Capacity re-priced onto Seacom for the window.",
    raisedAt: at(22),
  },
  {
    id: "alt-0006",
    title: "Packet loss at the Nairobi core",
    description:
      "Loss up to 0.94% on the Africa Data Centres interconnect, against a 0.1% commitment.",
    category: "sla",
    severity: "medium",
    entityId: "nod-nbo-02",
    entityLabel: "Africa Data Centres Nairobi",
    provider: "Africa Data Centres",
    city: "Nairobi",
    lat: -1.3052,
    lng: 36.8146,
    impactedGbps: 60,
    affectedSlas: 1,
    automatedAction: null,
    raisedAt: at(23),
  },
  {
    id: "alt-0007",
    title: "Payout rejected on chain mismatch",
    description:
      "415,000.00 USD payout returned: the wallet declared chain 8453 and the rail settled on 137.",
    category: "billing",
    severity: "medium",
    entityId: "stl-0012",
    entityLabel: "2026-01-payout-02",
    provider: "Sokowango Fiber",
    city: "Nairobi",
    lat: -1.3192,
    lng: 36.9278,
    impactedGbps: 0,
    affectedSlas: 0,
    automatedAction: "Wallet re-registered on the settlement chain; payout re-queued.",
    raisedAt: at(-19_439),
  },
  {
    id: "alt-0008",
    title: "Escrow top-up pending",
    description: "1,250,000.00 USD still unconfirmed 36 hours after the funding instruction.",
    category: "billing",
    severity: "low",
    entityId: "stl-0009",
    entityLabel: "2026-02-esc-02",
    provider: "Africa Data Centres",
    city: "Nairobi",
    lat: -1.3192,
    lng: 36.9278,
    impactedGbps: 0,
    affectedSlas: 0,
    automatedAction: "Funding confirmed on the seller's exchange; awaiting fiat settlement.",
    raisedAt: at(2_880),
  },
  {
    id: "alt-0009",
    title: "Kigali interconnect approaching its floor",
    description: "Shortfall of 10 bps against a 9,500 bps target. One more bad hour breaches it.",
    category: "sla",
    severity: "low",
    entityId: "nod-kig-01",
    entityLabel: "Kigali Interconnect",
    provider: "RCS",
    city: "Kigali",
    lat: -1.9441,
    lng: 30.0619,
    impactedGbps: 5,
    affectedSlas: 1,
    automatedAction: null,
    raisedAt: at(19),
  },
  // Security alerts below, and they are here because `alerts/security` is a rail
  // destination: a section with no rows in the seed is a section whose empty state
  // is the only thing anyone ever sees of it, and an empty state proves the query
  // compiles rather than that it answers. Three of them against one provider's edge,
  // which is the shape that section exists to collapse.
  {
    id: "alt-0010",
    title: "Unauthorised API session on the Equinix edge",
    description:
      "A session from an address block that has never appeared in this account's history, holding a token scoped to peering.",
    category: "security",
    severity: "critical",
    entityId: "nod-nbo-01",
    entityLabel: "Equinix Nairobi",
    provider: "Equinix",
    city: "Nairobi",
    lat: -1.3052,
    lng: 36.8146,
    impactedGbps: 0,
    affectedSlas: 0,
    automatedAction: "Session revoked; token reissued to the peering automation only.",
    raisedAt: at(6),
  },
  {
    id: "alt-0011",
    title: "Repeated peering-token authentication failures",
    description:
      "Fourteen failures in nine minutes from two source ranges, against a baseline of none in the trailing week.",
    category: "security",
    severity: "high",
    entityId: "nod-nbo-01",
    entityLabel: "Equinix Nairobi",
    provider: "Equinix",
    city: "Nairobi",
    lat: -1.3052,
    lng: 36.8146,
    impactedGbps: 0,
    affectedSlas: 0,
    automatedAction: "Source ranges blocked pending the provider's case reference.",
    raisedAt: at(5),
  },
  {
    id: "alt-0012",
    title: "Credentials older than the rotation window",
    description: "Two peering credentials are past the 90-day window the control standard sets.",
    category: "security",
    severity: "medium",
    entityId: "nod-nbo-01",
    entityLabel: "Equinix Nairobi",
    provider: "Equinix",
    city: "Nairobi",
    lat: -1.3052,
    lng: 36.8146,
    impactedGbps: 0,
    affectedSlas: 0,
    automatedAction: "Rotation scheduled into the next maintenance window.",
    raisedAt: at(240),
  },
  {
    id: "alt-0013",
    title: "Unauthorised BGP session accepted at the Mombasa ring",
    description:
      "A peering session was established from an autonomous system not on the ring's approved list.",
    category: "security",
    severity: "high",
    entityId: "nod-mba-02",
    entityLabel: "Mombasa Metro Ring",
    provider: "Sokowango Fiber",
    city: "Mombasa",
    lat: -4.0353,
    lng: 39.6192,
    impactedGbps: 0,
    affectedSlas: 0,
    automatedAction: "Session torn down; the ring re-converged in 40 seconds.",
    raisedAt: at(3),
  },
  // A second outage against the Nairobi CDN PoP, so `alerts/outages` has a group
  // with more than one alert in it and the count and the worst-severity rollup are
  // both exercised by the seed rather than by a hand-written fixture.
  {
    id: "alt-0014",
    title: "Nairobi CDN PoP still degraded after failover",
    description:
      "Failover held at 20 Gbps, but the origin's own health check has not recovered and the PoP is serving from cache.",
    category: "outage",
    severity: "medium",
    entityId: "nod-nbo-cdn",
    entityLabel: "Nairobi CDN PoP",
    provider: "Akamai",
    city: "Nairobi",
    lat: -1.2864,
    lng: 36.8172,
    impactedGbps: 20,
    affectedSlas: 1,
    automatedAction: "Origin health check running every 30 seconds.",
    raisedAt: at(14),
  },
] as const;

const CURRENCY = "USD" as const;

/**
 * The rows a given connection should hold.
 *
 * ## Every alert category, and why that is asserted rather than assumed
 *
 * `alerts/{outages,capacity,security}` each filter on `category`, so a category with
 * no rows in the seed is a section that can only ever render its empty state — and
 * an empty state proves the query compiles, not that it answers. `tests/seed.test.ts`
 * asserts every `ALERT_CATEGORIES` member is present, which is what turns "the
 * security section is blank" from a mystery into a failed test.
 *
 * Assembled here rather than inline in {@link seedDatabase} so the shape is a value
 * that can be inspected, asserted on, and — in a test — compared against what came
 * back out of the database without the comparison going through the same statements
 * that wrote it.
 */
export function seedRows() {
  return {
    orders: ORDERS.map((order) => ({ ...order, currency: CURRENCY })),
    spots: SPOT_POOLS.flatMap(({ pool, startMinor, bias, swing }) => {
      const priceMinor = [...priceWalk(startMinor, bias, swing)];
      return priceMinor.map((minor, step) => ({
        // Newest last, so the observations march forward through the day.
        pool,
        priceMinor: minor,
        currency: CURRENCY,
        observedAt: at(step * 15),
      }));
    }),
    nodes: [...NODES],
    settlements: SETTLEMENTS.map((line) => ({ ...line, currency: CURRENCY })),
    monitors: SLAS.map((row) => {
      const sla = slaCommitment(row.target, row.actual, row.creditNumerator, row.creditDenominator);
      return {
        id: row.id,
        account: row.account,
        nodeId: row.nodeId,
        nodeName: row.nodeName,
        provider: row.provider,
        targetBps: row.target,
        actualBps: row.actual,
        creditNumerator: row.creditNumerator,
        creditDenominator: row.creditDenominator,
        packetLossPpm: row.packetLossPpm,
        latencyP95Ms: row.latencyP95Ms,
        // Computed by the one function that defines the boundary. See the file header.
        state: slaState(sla),
        measuredAt: row.measuredAt,
      };
    }),
    alerts: [...ALERTS],
  };
}

/**
 * Put the seed rows into a database that has had the migrations run.
 *
 * Truncates first, so it is idempotent: running it twice leaves the same rows rather
 * than doubling them, and a developer re-seeding does not have to remember to drop
 * anything. `restart identity` is there because the market's spot series has an
 * identity column and a table that keeps counting across re-seeds gives two different
 * id sequences for the same data.
 *
 * The order matters only for the foreign key: `infrastructure_nodes` before
 * `sla_monitors`. Everything else is independent, and Drizzle sends each insert as
 * one multi-row statement so this is eight round trips rather than sixty.
 */
export async function seedDatabase(db: Database): Promise<void> {
  const rows = seedRows();

  await db.execute(truncateAll());
  await db.insert(schema.marketOrders).values(rows.orders);
  await db.insert(schema.marketSpots).values(rows.spots);
  await db.insert(schema.infrastructureNodes).values(rows.nodes);
  await db.insert(schema.settlements).values(rows.settlements);
  await db.insert(schema.slaMonitors).values(rows.monitors);
  await db.insert(schema.alerts).values(rows.alerts);
}

/**
 * Empty every table, and reset the identity sequences.
 *
 * `sql.raw` because this cannot be a bind parameter: the table list is this
 * workspace's own, written out in the same order as {@link seedRows} so a table
 * added to the schema without a truncate shows up as a `TRUNCATE` that leaves rows
 * behind — which the e2e test's row counts would catch.
 */
function truncateAll() {
  return sql`truncate table
    ${sql.raw("alerts")},
    ${sql.raw("sla_monitors")},
    ${sql.raw("settlements")},
    ${sql.raw("infrastructure_nodes")},
    ${sql.raw("market_spots")},
    ${sql.raw("market_orders")}
  restart identity cascade`;
}

/**
 * `pnpm db:seed`: migrate, then seed, against `CENTRAL_API_DATABASE_URL`.
 *
 * Guarded on this file being the entry point rather than on a flag, so importing
 * `seedDatabase` from a test — which is the whole reason the seeding is a function —
 * does not open a connection to a developer's real PostgreSQL as a side effect of
 * the import.
 *
 * `loadLocalEnv` here as well as in `main.ts`, and the reason it is not obvious
 * is worth recording: `db:migrate` goes through drizzle-kit, which reads `.env`
 * itself, so the two commands *look* like they have the same environment and only
 * one of them does. Following `.env.example` exactly — copy it, then `db:migrate`,
 * then `db:seed` — failed on the second command with the same
 * "must be a PostgreSQL connection string" error the service gives, against a
 * database that had just been migrated successfully.
 */
async function main(): Promise<void> {
  loadLocalEnv();

  const { databaseUrl } = loadEnv();
  const db = drizzle(databaseUrl, { schema, casing: "snake_case" });

  // Migrate before seeding rather than telling the developer to run two commands in
  // the right order: seeding into a database with no tables fails on the first insert
  // with a message about a relation that does not exist, which says nothing about
  // what to do next.
  await migrate(db, {
    migrationsFolder: resolve(fileURLToPath(import.meta.url), "../../../drizzle"),
  });

  const rows = seedRows();
  await seedDatabase(db as Database);

  const counts = Object.entries(rows)
    .map(([table, entries]) => `${table}=${entries.length}`)
    .join(" ");
  process.stdout.write(`seeded ${counts} into ${databaseUrl}\n`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
