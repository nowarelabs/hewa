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
 *
 * Exported because it is also the instant the e2e suite pins `CLOCK` to in
 * `tests/boot.ts`, and a suite that pinned its own date would put the ageing
 * assertions a day out of step with the fixture's due dates every time the epoch
 * moved. One constant, so "which day is it in these tests" has one answer.
 */
export const EPOCH = Date.parse("2026-02-01T00:00:00.000Z");

const MINUTE = 60_000;

/** `EPOCH` plus whole minutes, so the fixture reads as "twelve minutes in". */
const at = (minutes: number): Date => new Date(EPOCH + minutes * MINUTE);

/** Minutes in a day, for the two helpers below. */
const DAY_MINUTES = 24 * 60;

/**
 * `EPOCH` minus whole days.
 *
 * The ageing fixtures need dates on either side of `EPOCH`, and `at` only takes
 * minutes — so these two spell the day boundary once rather than making every call
 * site write `at(-40 * 24 * 60)`, which is a number nobody can check at a glance.
 */
const daysBefore = (days: number): Date => at(-days * DAY_MINUTES);

/** `EPOCH` plus whole days. */
const daysAfter = (days: number): Date => at(days * DAY_MINUTES);

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
 * The customers the existing SLA rows are already about.
 *
 * Reused rather than invented, because `finance_bills.isp_id` and `sla_monitors
 * .account` name the same five companies and a seed that gave them two sets of
 * names would make "is this ISP's bill overdue" unanswerable across the two tables.
 * The id is the stable half; the name is carried on every row that draws it.
 */
const ISPS = [
  { id: "isp-coastal", name: "Coastal Broadband" },
  { id: "isp-airtel", name: "Airtel Business" },
  { id: "isp-he", name: "Hurricane Electric" },
  { id: "isp-sokowango", name: "Sokowango Fiber" },
  { id: "isp-vodacom", name: "Vodacom Tanzania" },
] as const;

const ispName = (ispId: string): string => {
  const found = ISPS.find((isp) => isp.id === ispId);
  if (found === undefined) {
    throw new Error(`Seed references an unknown ISP: ${ispId}`);
  }
  return found.name;
};

/**
 * Eleven bills: one per ISP for each of the three months around {@link EPOCH}.
 *
 * ## Why the due dates are the point of this fixture
 *
 * `revenue/receivables` ages every bill against the injected clock, and its group
 * vocabulary is five ageing buckets. The e2e suite pins the clock to `EPOCH`, and
 * these due dates are placed around it so that every bucket holds at least one
 * `issued` or `disputed` bill:
 *
 * | Bucket     | Bill       | Due            | Overdue at `EPOCH` |
 * | ---------- | ---------- | -------------- | ------------------ |
 * | `current`  | `bil-0006` | `EPOCH + 30d`  | −30 (not yet due)  |
 * | `d1_30`    | `bil-0005` | `EPOCH − 12d`  | 12                 |
 * | `d1_30`    | `bil-0007` | `EPOCH − 10d`  | 10                 |
 * | `d31_60`   | `bil-0008` | `EPOCH − 40d`  | 40                 |
 * | `d61_90`   | `bil-0009` | `EPOCH − 70d`  | 70                 |
 * | `d90_plus` | `bil-0010` | `EPOCH − 100d` | 100                |
 *
 * A bucket with no row in it is a chip that filters to nothing, which is a worse
 * control than no chip at all, and `tests/schema.test.ts` asserts the coverage so
 * this table cannot lose one without a test noticing.
 *
 * `bil-0007` is the only partly settled one, so the section has a row whose
 * `outstanding` is neither its total nor nothing — a column where every row is zero
 * or whole cannot tell a subtraction that ran from one that was skipped.
 */
const BILLS = [
  {
    id: "bil-0001",
    ispId: "isp-coastal",
    month: "2026-01",
    committedMbps: 1_000,
    commitmentChargeMinor: 100_000_00,
    overageChargeMinor: 4_250_00,
    slaCreditMinor: -12_500_00,
    status: "paid",
    dueAt: daysBefore(17),
    disputeReason: null,
    issuedAt: daysBefore(45),
    settledMinor: 91_750_00,
  },
  {
    id: "bil-0002",
    ispId: "isp-airtel",
    month: "2026-01",
    committedMbps: 2_500,
    commitmentChargeMinor: 250_000_00,
    overageChargeMinor: 0,
    slaCreditMinor: 0,
    status: "paid",
    dueAt: daysBefore(17),
    disputeReason: null,
    issuedAt: daysBefore(45),
    settledMinor: 250_000_00,
  },
  {
    id: "bil-0003",
    ispId: "isp-he",
    month: "2026-01",
    committedMbps: 100,
    commitmentChargeMinor: 10_000_00,
    overageChargeMinor: 900_00,
    slaCreditMinor: 0,
    // Withdrawn rather than deleted: this workspace has no delete on a finance
    // table, and a January bill for an ISP that never took the service is a fact.
    status: "void",
    dueAt: daysBefore(17),
    disputeReason: null,
    issuedAt: daysBefore(45),
    settledMinor: 0,
  },
  {
    id: "bil-0004",
    ispId: "isp-sokowango",
    month: "2026-01",
    committedMbps: 500,
    commitmentChargeMinor: 50_000_00,
    overageChargeMinor: 1_100_00,
    slaCreditMinor: -2_500_00,
    status: "paid",
    dueAt: daysBefore(17),
    disputeReason: null,
    issuedAt: daysBefore(45),
    settledMinor: 48_600_00,
  },
  {
    id: "bil-0005",
    ispId: "isp-vodacom",
    month: "2026-01",
    committedMbps: 3_000,
    commitmentChargeMinor: 300_000_00,
    overageChargeMinor: 22_400_00,
    slaCreditMinor: -18_000_00,
    status: "disputed",
    dueAt: daysBefore(12),
    disputeReason:
      "Overage metered against the Dar es Salaam commitment instead of ours for four days.",
    issuedAt: daysBefore(45),
    settledMinor: 0,
  },
  {
    id: "bil-0006",
    ispId: "isp-coastal",
    month: "2026-02",
    committedMbps: 1_000,
    commitmentChargeMinor: 100_000_00,
    overageChargeMinor: 3_100_00,
    slaCreditMinor: 0,
    status: "issued",
    dueAt: daysAfter(30),
    disputeReason: null,
    issuedAt: daysBefore(1),
    settledMinor: 0,
  },
  {
    id: "bil-0007",
    ispId: "isp-airtel",
    month: "2026-02",
    committedMbps: 2_500,
    commitmentChargeMinor: 250_000_00,
    overageChargeMinor: 0,
    slaCreditMinor: 0,
    status: "issued",
    dueAt: daysBefore(10),
    disputeReason: null,
    issuedAt: daysBefore(1),
    // Partly paid, so `outstanding` is neither the total nor nothing.
    settledMinor: 100_000_00,
  },
  {
    id: "bil-0008",
    ispId: "isp-he",
    month: "2026-02",
    committedMbps: 100,
    commitmentChargeMinor: 10_000_00,
    overageChargeMinor: 1_450_00,
    slaCreditMinor: -900_00,
    status: "issued",
    dueAt: daysBefore(40),
    disputeReason: null,
    issuedAt: daysBefore(1),
    settledMinor: 0,
  },
  {
    id: "bil-0009",
    ispId: "isp-sokowango",
    month: "2026-02",
    committedMbps: 500,
    commitmentChargeMinor: 50_000_00,
    overageChargeMinor: 8_800_00,
    slaCreditMinor: 0,
    status: "disputed",
    dueAt: daysBefore(70),
    disputeReason: "Second Mombasa metro ring outage in the month; credit requested twice over.",
    issuedAt: daysBefore(1),
    settledMinor: 0,
  },
  {
    id: "bil-0010",
    ispId: "isp-vodacom",
    month: "2026-02",
    committedMbps: 3_000,
    commitmentChargeMinor: 300_000_00,
    overageChargeMinor: 31_900_00,
    slaCreditMinor: -6_000_00,
    status: "issued",
    dueAt: daysBefore(100),
    disputeReason: null,
    issuedAt: daysBefore(1),
    settledMinor: 0,
  },
  {
    id: "bil-0011",
    ispId: "isp-coastal",
    month: "2026-03",
    committedMbps: 1_000,
    commitmentChargeMinor: 100_000_00,
    overageChargeMinor: 0,
    slaCreditMinor: 0,
    // The only draft, and it is the reason `revenue/receivables` excludes `draft`:
    // a month that has not been issued is not yet money anybody owes.
    status: "draft",
    dueAt: daysAfter(58),
    disputeReason: null,
    issuedAt: daysAfter(28),
    settledMinor: 0,
  },
] as const;

/**
 * Three credits, one per basis, because `revenue/credits` filters on it.
 *
 * Every one of them is negative, which is the ledger's convention and the reason the
 * `finance_credits_amount_lte_zero` check exists: a credit that raised a receivable
 * would be a charge under a column named after a reduction.
 *
 * ## These are credits taken **after** the bill was issued, not its SLA line
 *
 * A bill carries an `sla_credit_minor` of its own, and no row here repeats one. The
 * difference is the reason the two cannot be added together twice: the SLA line is
 * priced into the invoice before it is issued, while a row here is a decision taken
 * afterwards — a meter reading that turned out to be wrong, a goodwill gesture, half
 * a shortfall credited while a report is read.
 *
 * `revenue/receivables` therefore reduces a bill's net total by these rows as well as
 * subtracting what has been settled, and that is the only place the three credit
 * tables' facts meet. `crd-0001` is deliberately not `12,500` and `crd-0002` is
 * deliberately not `18,000`: a fixture where a credit row repeats a bill's SLA figure
 * exactly is a fixture where the reader cannot tell whether the two are the same
 * money, and the receivables figure would then depend on the answer.
 */
const CREDITS = [
  {
    id: "crd-0001",
    billId: "bil-0006",
    amountMinor: -6_250_00,
    basis: "sla_shortfall",
    note: "February commitment metered at 99.87% for four days; half the shortfall credited while the third-party monitor's report is read.",
    recordedAt: daysBefore(2),
  },
  {
    id: "crd-0002",
    billId: "bil-0005",
    amountMinor: -9_000_00,
    basis: "dispute",
    note: "Half the disputed overage credited now; the meter reading is still being checked.",
    recordedAt: daysBefore(9),
  },
  {
    id: "crd-0003",
    billId: "bil-0004",
    amountMinor: -7_500_00,
    basis: "goodwill",
    note: "Second Mombasa metro ring outage in January; credited as a gesture, not against the SLA.",
    recordedAt: daysBefore(6),
  },
] as const;

/**
 * Six obligations, one per `PAYOUT_STATUSES` member.
 *
 * All five states are present for the same reason the ageing buckets are: a chip for
 * a state with no row is a control that filters to nothing. The `failed` row carries
 * a reason and no other row does, because the `finance_payouts_failure_reason_iff_
 * failed` check refuses the other combination — so a payout that stopped says why
 * and one that moved says nothing, which are different facts that would otherwise
 * render as the same dash.
 *
 * `reference` names the bill each payout settles, and every one of those bills is
 * `issued` or `paid`: an obligation against a `void` bill would be money owed for a
 * month that was withdrawn.
 */
const PAYOUTS = [
  {
    id: "pay-0001",
    ispId: "isp-coastal",
    amountMinor: 91_750_00,
    feeMinor: 450_00,
    status: "completed",
    method: "bank",
    reference: "bil-0001",
    occurredAt: daysBefore(14),
    failureReason: null,
  },
  {
    id: "pay-0002",
    ispId: "isp-airtel",
    amountMinor: 250_000_00,
    feeMinor: 1_200_00,
    status: "completed",
    method: "usdc",
    reference: "bil-0002",
    occurredAt: daysBefore(14),
    failureReason: null,
  },
  {
    id: "pay-0003",
    ispId: "isp-sokowango",
    amountMinor: 48_600_00,
    feeMinor: 260_00,
    status: "sending",
    method: "usdc",
    reference: "bil-0004",
    occurredAt: daysBefore(2),
    failureReason: null,
  },
  {
    id: "pay-0004",
    ispId: "isp-vodacom",
    amountMinor: 325_900_00,
    feeMinor: 1_500_00,
    status: "pending",
    method: "bank",
    reference: "bil-0010",
    occurredAt: daysBefore(1),
    failureReason: null,
  },
  {
    id: "pay-0005",
    ispId: "isp-he",
    amountMinor: 10_550_00,
    feeMinor: 60_00,
    status: "converting",
    method: "usdc",
    reference: "bil-0008",
    occurredAt: at(30),
    failureReason: null,
  },
  {
    id: "pay-0006",
    ispId: "isp-coastal",
    amountMinor: 103_100_00,
    feeMinor: 480_00,
    status: "failed",
    method: "usdc",
    reference: "bil-0006",
    occurredAt: at(45),
    failureReason: "Rail rejected the transfer: the destination wallet is on an unsupported chain.",
  },
] as const;

/**
 * The chart of accounts, one per `ACCOUNT_TYPES` member plus a second asset.
 *
 * Two assets rather than one so the `ledger/ledger` section has a group with more
 * than one row in it, which is what tells a rollup that added up correctly from one
 * that did not add up at all.
 *
 * `normalSide` is not a column and never will be. It is derived from `type` by
 * `@hewa/ledger-accounting`'s `account(...)`, so "a revenue balance is positive
 * because it was credited" has one definition in this workspace.
 */
const LEDGER_ACCOUNTS = [
  { id: "acc-1000", name: "Accounts receivable", type: "asset", currency: CURRENCY },
  { id: "acc-1001", name: "Cash at bank", type: "asset", currency: CURRENCY },
  { id: "acc-2000", name: "Payout obligations", type: "liability", currency: CURRENCY },
  { id: "acc-3000", name: "Marketplace revenue", type: "revenue", currency: CURRENCY },
  { id: "acc-4000", name: "Network operating costs", type: "expense", currency: CURRENCY },
  { id: "acc-5000", name: "Retained earnings", type: "equity", currency: CURRENCY },
] as const;

/**
 * Eight journal entries, every one of which balances.
 *
 * Each entry is a positive posting beside a negative one, so the pair sums to zero by
 * construction — and `tests/schema.test.ts` re-derives the whole trial balance through
 * `@hewa/ledger-accounting`'s own `trialBalance` rather than trusting that.
 *
 * The signs are the ledger's, not the accounts': a revenue account is credited with a
 * **negative** posting and its balance still reads positive, because
 * `balancesFrom` flips it onto the normal side. That is the convention
 * `totalsFor` reads, and writing the opposite here would be a second one.
 *
 * `reference` is unique, so a retrying settlement pipeline cannot post twice — and
 * every account ends with a non-zero balance, because an account whose balance is
 * always zero tells a reader nothing about whether the fold ran.
 */
const LEDGER_ENTRIES = [
  {
    id: "jrn-0001",
    reference: "2026-01:accrual",
    description: "January billing run: revenue accrued against receivables.",
    occurredAt: daysBefore(45),
    postings: [
      { accountId: "acc-1000", amountMinor: 689_350_00 },
      { accountId: "acc-3000", amountMinor: -689_350_00 },
    ],
  },
  {
    id: "jrn-0002",
    reference: "2026-02:accrual",
    description: "February billing run: revenue accrued against receivables.",
    occurredAt: daysBefore(1),
    postings: [
      { accountId: "acc-1000", amountMinor: 806_350_00 },
      { accountId: "acc-3000", amountMinor: -806_350_00 },
    ],
  },
  {
    id: "jrn-0003",
    reference: "2026-01:operating-costs",
    description: "January network operating costs paid from cash.",
    occurredAt: daysBefore(20),
    postings: [
      { accountId: "acc-4000", amountMinor: 212_400_00 },
      { accountId: "acc-1001", amountMinor: -212_400_00 },
    ],
  },
  {
    id: "jrn-0004",
    reference: "2026-01:obligations",
    description: "January payout obligations recognised as cost and liability.",
    occurredAt: daysBefore(16),
    postings: [
      { accountId: "acc-4000", amountMinor: 389_350_00 },
      { accountId: "acc-2000", amountMinor: -389_350_00 },
    ],
  },
  {
    id: "jrn-0005",
    reference: "2026-01:payouts",
    description: "January payouts settled against cash.",
    occurredAt: daysBefore(14),
    postings: [
      { accountId: "acc-2000", amountMinor: 389_350_00 },
      { accountId: "acc-1001", amountMinor: -389_350_00 },
    ],
  },
  {
    id: "jrn-0006",
    reference: "2026-02:sla-credits",
    description: "February SLA credits issued: revenue reduced and receivables relieved.",
    occurredAt: daysBefore(3),
    postings: [
      { accountId: "acc-3000", amountMinor: 12_400_00 },
      { accountId: "acc-1000", amountMinor: -12_400_00 },
    ],
  },
  {
    id: "jrn-0007",
    reference: "2025-12:capital",
    description: "Opening capital contributed by the owners.",
    occurredAt: daysBefore(45),
    postings: [
      { accountId: "acc-1001", amountMinor: 1_000_000_00 },
      { accountId: "acc-5000", amountMinor: -1_000_000_00 },
    ],
  },
  {
    id: "jrn-0008",
    reference: "2026-02:obligations",
    description: "February payout obligations recognised and not yet settled.",
    occurredAt: daysBefore(1),
    postings: [
      { accountId: "acc-4000", amountMinor: 460_550_00 },
      { accountId: "acc-2000", amountMinor: -460_550_00 },
    ],
  },
] as const;

/**
 * One month of daily attestations for three cities.
 *
 * ## Coverage is the group vocabulary, so one city is short a day on purpose
 *
 * `proof/attestations` groups by its month's verdict, which is `complete` when every
 * day of the month is published and `partial` when some are. Two complete cities and
 * one that stops on the nineteenth puts both verdicts on screen, and the partial one
 * is what an operator is looking for when they open the view.
 *
 * ## The days are generated, and the figures are a fixed walk
 *
 * Eighty-one hand-written rows would be eighty-one chances to mistype a figure, and
 * none of them is the thing under test. `gross` steps by a constant per day and
 * `costs` is 62% of it — no clock, no randomness, so a failing assertion names one
 * day rather than a moving target. This is the same reasoning as `priceWalk` for the
 * market's spot series.
 */
const ATTESTED_CITIES = [
  { slug: "nbo", city: "Nairobi", days: 31, grossStartMinor: 420_000_00 },
  { slug: "mba", city: "Mombasa", days: 19, grossStartMinor: 265_000_00 },
  { slug: "dar", city: "Dar es Salaam", days: 31, grossStartMinor: 310_000_00 },
] as const;

/** The month every seeded attestation belongs to. January, which is complete by date. */
const ATTESTED_MONTH = "2026-01";

/**
 * When a day's figures were published.
 *
 * Six in the morning, so it reads as a job that ran rather than as an instant that
 * happens to be midnight — and it is derived from the row's own month and day rather
 * than from `EPOCH`, because `EPOCH` is 1 February and every attestation here is in
 * January.
 */
const publishedAt = (month: string, day: number): Date =>
  new Date(Date.parse(`${month}-${String(day).padStart(2, "0")}T06:00:00.000Z`));

const ATTESTATIONS = ATTESTED_CITIES.flatMap(({ slug, city, days, grossStartMinor }) =>
  Array.from({ length: days }, (_, index) => {
    const day = index + 1;
    const grossMinor = grossStartMinor + day * 1_275_00;
    return {
      id: `att-${slug}-${ATTESTED_MONTH}-${String(day).padStart(2, "0")}`,
      city,
      month: ATTESTED_MONTH,
      day,
      currency: CURRENCY,
      grossMinor,
      // A whole number of minor units, never a division: `Math.round` on a ratio is
      // the one rounding in this file, it happens here where it can be seen, and the
      // value it produces is a figure a ledger can carry.
      costsMinor: Math.round(grossMinor * 0.62),
      publishedAt: publishedAt(ATTESTED_MONTH, day),
    };
  }),
);

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

    // Finance. The two flat lists are the entries and their legs, kept apart because
    // the tables are: a test that rebuilds `JournalEntry` objects out of them is
    // exercising the same join the service does, rather than reading back a nested
    // structure the seed happened to build in memory.
    bills: BILLS.map((bill) => ({ ...bill, ispName: ispName(bill.ispId), currency: CURRENCY })),
    credits: CREDITS.map((credit) => ({ ...credit })),
    payouts: PAYOUTS.map((payout) => ({
      ...payout,
      ispName: ispName(payout.ispId),
      currency: CURRENCY,
    })),
    ledgerAccounts: LEDGER_ACCOUNTS.map((account_) => ({ ...account_ })),
    ledgerEntries: LEDGER_ENTRIES.map(({ postings: _legs, ...entry }) => ({
      ...entry,
      currency: CURRENCY,
    })),
    ledgerPostings: LEDGER_ENTRIES.flatMap((entry) =>
      entry.postings.map((leg) => ({ entryId: entry.id, ...leg })),
    ),
    attestations: ATTESTATIONS.map((attestation) => ({ ...attestation })),
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
 * The order matters for the foreign keys and only for them: `infrastructure_nodes`
 * before `sla_monitors`, and on the finance side the chart before the entries, the
 * entries before their legs, and the bills before the credits that point at them.
 * Everything else is independent, and Drizzle sends each insert as one multi-row
 * statement so this is fourteen round trips rather than a hundred and thirty.
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
  await db.insert(schema.financeBills).values(rows.bills);
  await db.insert(schema.financeCredits).values(rows.credits);
  await db.insert(schema.financePayouts).values(rows.payouts);
  await db.insert(schema.financeLedgerAccounts).values(rows.ledgerAccounts);
  await db.insert(schema.financeLedgerEntries).values(rows.ledgerEntries);
  await db.insert(schema.financeLedgerPostings).values(rows.ledgerPostings);
  await db.insert(schema.financeAttestations).values(rows.attestations);
}

/**
 * Empty every table, and reset the identity sequences.
 *
 * `sql.raw` because this cannot be a bind parameter: the table list is this
 * workspace's own, written out in the same order as {@link seedRows} so a table
 * added to the schema without a truncate shows up as a `TRUNCATE` that leaves rows
 * behind — which the e2e test's row counts would catch.
 *
 * `cascade` means the order here is documentation rather than a requirement, which is
 * the better property: a table added to this list without a truncate is caught by a
 * row count, and a table left out of the schema entirely is caught by the migration.
 */
function truncateAll() {
  return sql`truncate table
    ${sql.raw("alerts")},
    ${sql.raw("finance_attestations")},
    ${sql.raw("finance_ledger_postings")},
    ${sql.raw("finance_ledger_entries")},
    ${sql.raw("finance_ledger_accounts")},
    ${sql.raw("finance_payouts")},
    ${sql.raw("finance_credits")},
    ${sql.raw("finance_bills")},
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
