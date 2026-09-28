Excellent question. Let me map out the call stack trace trees for the major data flows through your system. I'll show you how the services communicate and what triggers them.

---

## **1. ISP Payment Flow (Real-Time)**

```
ISP makes payment via payment gateway
    │
    ├─→ payment-gateway-adapter (infra-service)
    │   │ Receives webhook from Stripe/M-Pesa/Bank
    │   │ Validates signature
    │   │ Extracts: ispId, amount, timestamp, transactionId
    │   │
    │   ├─→ event-gateway (infra-service)
    │   │   │ Publishes event to Kafka topic: "payment.received"
    │   │   │ Event: { ispId, amount, txHash, timestamp }
    │   │   │
    │   │   └─→ Kafka topic: "payment.received"
    │   │       (Other services subscribed to this)
    │   │
    │   ├─→ settlement-service (NestJS)
    │   │   │ Consumes: "payment.received" event
    │   │   │ Updates settlement-domain logic
    │   │   │ POST /settlement/record-payment
    │   │   │   Body: { ispId, amount, txHash, timestamp }
    │   │   │
    │   │   ├─→ ledger-service (NestJS)
    │   │   │   │ POST /ledger/record-transaction
    │   │   │   │   DEBIT: ISP Settlement Account $X
    │   │   │   │   CREDIT: Share Treasury $X
    │   │   │   │
    │   │   │   └─→ PostgreSQL: ledger table updated
    │   │   │
    │   │   ├─→ billing-service (NestJS)
    │   │   │   │ POST /billing/apply-payment
    │   │   │   │   ispId: "vituIT"
    │   │   │   │   amount: 2000 USD
    │   │   │   │
    │   │   │   └─→ PostgreSQL: isps.account_balance updated
    │   │   │
    │   │   └─→ webhook-engine
    │   │       │ POST /webhooks/notify
    │   │       │   Sends: payment.confirmed to ISP's callback URL
    │   │       │   Headers: X-Signature: <signed>
    │   │       │
    │   │       └─→ ISP's system receives payment confirmation
    │   │
    │   └─→ document-vault (infra-service)
    │       │ POST /vault/store
    │       │   Stores payment receipt to S3
    │       │   Object: payment-receipt-{transactionId}.pdf
    │       │
    │       └─→ AWS S3 (immutable audit trail)
    │
    └─→ isp-partner-portal (Next.js)
        │ (Real-time via WebSocket/Polling)
        │ GET /api/payments/latest
        │
        └─→ Dashboard shows: "Payment received: $2,000 at 2:15 PM"
```

---

## **2. Daily Revenue Attestation Flow (Scheduled)**

```
00:00 UTC - Cron triggers oracle-service
    │
    └─→ oracle-service (hypothetical - missing from monorepo!)
        │ Triggered: Every day at 00:00 UTC
        │
        ├─→ revenue-service (NestJS)
        │   │ GET /revenue/daily-aggregate?date=yesterday
        │   │
        │   ├─→ ledger-service
        │   │   │ GET /ledger/daily-total
        │   │   │   Queries: transactions where date = yesterday
        │   │   │   Returns: { johannesburg: 6700, mombasa: 8200, ... }
        │   │   │
        │   │   └─→ PostgreSQL:
        │   │       SELECT SUM(amount) FROM transactions
        │   │       WHERE date = '2026-09-28' AND status = 'completed'
        │   │
        │   └─→ billing-service
        │       │ GET /billing/isp-breakdown?date=yesterday
        │       │   Returns: VituIT: 2000, WorkOnline: 1500, ...
        │       │
        │       └─→ PostgreSQL: isps_transactions table
        │
        ├─→ revenue-proof-protocol (package)
        │   │ Generate Merkle tree of daily ISP payments
        │   │ Input: { ispId, amount } for each transaction
        │   │
        │   ├─→ crypto (package)
        │   │   │ Sign with HSM-protected private key
        │   │   │ Generates signature proof
        │   │   │
        │   │   └─→ ethers.js: keccak256(encoded data)
        │   │
        │   └─→ blockchain-types (package)
        │       │ Structured attestation object:
        │       │ {
        │       │   date: "2026-09-28",
        │       │   cities: { johannesburg: 6700 },
        │       │   merkleRoot: "0x123abc...",
        │       │   signature: "0x456def...",
        │       │   timestamp: 1695859200
        │       │ }
        │       │
        │       └─→ (Ready to post on-chain)
        │
        └─→ payment-gateway-adapter (infra-service)
            │ POST /blockchain/record-revenue
            │   Calls smart contract on Polygon
            │   recordDailyRevenue(date, amount, signature)
            │
            ├─→ Blockchain (Polygon)
            │   │ Smart contract: JohannesburgBond.sol
            │   │ Function: recordDailyRevenue(uint256, uint256, bytes)
            │   │ Updates: mapping(date => amount)
            │   │
            │   └─→ Emits: RevenueRecorded(date, amount)
            │
            └─→ bondholder-transparency-portal (Next.js)
                │ (Real-time via Web3 subscription)
                │ Listens to: RevenueRecorded event
                │
                └─→ Dashboard updates:
                    "Sept 28: $6,700 revenue verified on-chain"
```

---

## **3. Monthly Billing Cycle (Scheduled)**

```
1st of month, 00:01 UTC - system-queue triggers billing job
    │
    └─→ system-queue (infra-service with BullMQ)
        │ Job: "generate-monthly-bills"
        │ Retry: 3x with exponential backoff
        │
        ├─→ revenue-service (NestJS)
        │   │ GET /revenue/monthly-by-isp?month=09-2026
        │   │
        │   ├─→ metering-service (NestJS)
        │   │   │ GET /metering/monthly-usage?ispId=vituIT&month=09-2026
        │   │   │
        │   │   ├─→ Queries TimescaleDB for bandwidth metrics:
        │   │   │   SELECT AVG(bandwidth_mbps), MAX(bandwidth_mbps)
        │   │   │   FROM metrics
        │   │   │   WHERE isp_id = 'vituIT'
        │   │   │   AND date_trunc('month', timestamp) = '2026-09'
        │   │   │
        │   │   └─→ Returns: { committed: 100, actual: 120, burst: 200 }
        │   │
        │   ├─→ billing-domain (package)
        │   │   │ Calculates monthly bill:
        │   │   │
        │   │   │ commitment_charge = 100 Mbps × $0.30 = $30
        │   │   │ overage_charge = (120 - 100) × $0.50 × 24hrs × 30days
        │   │   │ sla_actual = 98% (target 99.5%)
        │   │   │ sla_credit = $30 × (99.5 - 98) × 0.10 = -$4.50
        │   │   │
        │   │   │ total_bill = $30 + overage - $4.50
        │   │   │
        │   │   └─→ Returns: MonthlyBill object
        │   │
        │   └─→ invoicing-service (NestJS)
        │       │ POST /invoicing/generate-invoice
        │       │   Body: {
        │       │     ispId: "vituIT",
        │       │     month: "09-2026",
        │       │     items: [
        │       │       { description: "100 Mbps Commitment", amount: 30 },
        │       │       { description: "Overage (20 Mbps)", amount: 15 },
        │       │       { description: "SLA Credit", amount: -4.50 }
        │       │     ],
        │       │     total: 40.50
        │       │   }
        │       │
        │       ├─→ document-vault (infra-service)
        │       │   │ POST /vault/generate-pdf
        │       │   │   Generates invoice PDF
        │       │   │
        │       │   └─→ AWS S3: invoice-09-2026-vituIT.pdf
        │       │
        │       ├─→ ledger-service (NestJS)
        │       │   │ POST /ledger/record-invoice
        │       │   │
        │       │   │ DEBIT: ISP Receivable Account: $40.50
        │       │   │ CREDIT: Revenue Account: $40.50
        │       │   │
        │       │   └─→ PostgreSQL: journal_entries table
        │       │
        │       └─→ webhook-engine
        │           │ POST /webhooks/notify
        │           │ Event: "invoice.created"
        │           │ Delivers invoice PDF to ISP's system
        │           │
        │           └─→ ISP receives: Invoice in their portal
        │
        ├─→ billing-reconciliation-ui (Next.js)
        │   │ GET /api/reconciliation/pending
        │   │ Alerts: "12 invoices generated, waiting for payment"
        │   │
        │   └─→ Share ops team reviews and approves batch send
        │
        └─→ isp-partner-portal (Next.js)
            │ ISP sees: "Invoice due: $40.50 (due Oct 8)"
            │ ISP clicks: Pay Now → redirected to payment gateway
            │
            └─→ Payment flow begins (see flow #1)
```

---

## **4. Settlement & Payout Flow (Scheduled + Triggered)**

```
15th of month, 02:00 UTC - system-queue triggers payout job
    │
    └─→ system-queue (BullMQ)
        │ Job: "process-monthly-payouts"
        │
        ├─→ ledger-service (NestJS)
        │   │ GET /ledger/monthly-net-revenue?month=09-2026
        │   │
        │   ├─→ PostgreSQL query:
        │   │   Revenue: SUM where type='revenue' = $250,000
        │   │   Costs: SUM where type='cost' = $80,000
        │   │   Net: $170,000
        │   │
        │   └─→ Returns: { revenue: 250k, costs: 80k, net: 170k }
        │
        ├─→ settlement-service (NestJS)
        │   │ POST /settlement/calculate-payouts?month=09-2026
        │   │
        │   ├─→ settlement-domain (package)
        │   │   │ For each ISP:
        │   │   │   ispNetRevenue = ispIncome - ispCosts
        │   │   │   shareMargin = ispNetRevenue × 0.20
        │   │   │   ispPayout = ispNetRevenue - shareMargin
        │   │   │
        │   │   └─→ { ispId: "vituIT", payout: 12500, currency: "USD" }
        │   │
        │   ├─→ crypto (package)
        │   │   │ POST /crypto/convert-usd-to-stablecoin
        │   │   │   amount: 12500 USD → 12500 USDC
        │   │   │   rate: 1.0 (spot check)
        │   │   │
        │   │   └─→ Returns: stablecoinAmount
        │   │
        │   ├─→ payment-gateway-adapter (infra-service)
        │   │   │ POST /blockchain/send-stablecoin
        │   │   │   to: "0xVituIT_wallet_address"
        │   │   │   amount: 12500 USDC
        │   │   │   network: "polygon"
        │   │   │
        │   │   ├─→ ethers.js: usdcContract.transfer(address, amount)
        │   │   │   Signs transaction with HSM key
        │   │   │   Broadcasts to Polygon
        │   │   │
        │   │   └─→ Blockchain: Tx confirmed, txHash: 0x789xyz...
        │   │
        │   ├─→ ledger-service (NestJS)
        │   │   │ POST /ledger/record-payout
        │   │   │   DEBIT: Share Retained Earnings: $2,500 (margin)
        │   │   │   CREDIT: ISP Payout Account: $12,500
        │   │   │   DEBIT: Blockchain Tx Fee: $2 (gas)
        │   │   │   CREDIT: Operations Expense: $2
        │   │   │
        │   │   └─→ PostgreSQL: journal_entries, payouts table
        │   │
        │   └─→ webhook-engine
        │       │ POST /webhooks/notify
        │       │ Event: "payout.processed"
        │       │ Data: {
        │       │   ispId: "vituIT",
        │       │   amount: 12500,
        │       │   currency: "USDC",
        │       │   txHash: "0x789xyz...",
        │       │   timestamp: 1695891600
        │       │ }
        │       │
        │       └─→ ISP receives: Push notification
        │           "✓ Payout confirmed: 12,500 USDC received"
        │
        └─→ financial-dashboard (Next.js)
            │ GET /api/financials/monthly-summary
            │ Shows: Total payouts processed, margins retained
            │
            └─→ Share leadership sees:
                "Sep payouts: $160K sent, $10K retained as margin"
```

---

## **5. Reconciliation Flow (Daily + On-Demand)**

```
Daily, 01:00 UTC - system-queue triggers reconciliation job
    │
    └─→ reconciliation-service (NestJS)
        │ Job: "daily-reconciliation"
        │
        ├─→ metering-service (NestJS)
        │   │ GET /metering/daily-totals?date=yesterday
        │   │
        │   └─→ TimescaleDB: "Share measured: VituIT used 120 Mbps"
        │
        ├─→ ledger-service (NestJS)
        │   │ GET /ledger/daily-reported?date=yesterday
        │   │
        │   └─→ PostgreSQL: "VituIT claimed: 120 Mbps in their API calls"
        │
        ├─→ billing-domain (package)
        │   │ Compare: measured (120) vs reported (120)
        │   │ Difference: 0% ✓
        │   │
        │   └─→ Status: RECONCILED
        │
        ├─→ IF difference > 5%:
        │   │
        │   ├─→ revenue-proof-protocol (package)
        │   │   │ Generate dispute proof:
        │   │   │ Merkle path showing: Transaction A, B, C added up to 120
        │   │   │
        │   │   └─→ Cryptographic proof included
        │   │
        │   ├─→ webhook-engine
        │   │   │ POST /webhooks/notify
        │   │   │ Event: "usage-dispute.flagged"
        │   │   │ Data: {
        │   │   │   ispId: "vituIT",
        │   │   │   measured: 122.5,
        │   │   │   reported: 115,
        │   │   │   discrepancy: 7.5 Mbps (6.5%),
        │   │   │   proof: <merkle proof>
        │   │   │ }
        │   │
        │   └─→ ISP receives notification: "Usage discrepancy detected"
        │
        └─→ billing-reconciliation-ui (Next.js)
            │ GET /api/reconciliation/status
            │ Shows:
            │   ✓ 47 ISPs reconciled
            │   ⚠️ 3 ISPs flagged for review
            │   ✗ 1 ISP needs manual intervention
            │
            └─→ Share ops team investigates disputes
```

---

## **6. Real-Time Metrics Ingestion Flow (Continuous)**

```
Router sends metrics every 5 minutes
    │
    └─→ metrics-ingestion (infra-service with Hono)
        │ POST /metrics/ingest
        │ Body: {
        │   ispId: "vituIT",
        │   timestamp: 1695891600,
        │   bandwidth_in_mbps: 120.5,
        │   bandwidth_out_mbps: 95.2,
        │   latency_ms: 45,
        │   packet_loss_pct: 0.02,
        │   uptime_pct: 99.8
        │ }
        │
        ├─→ event-gateway (infra-service)
        │   │ Publishes: "metrics.received" to Kafka
        │   │ Topic: high-throughput, partitioned by ispId
        │   │
        │   └─→ Kafka: metrics.received topic
        │
        ├─→ metering-service (NestJS)
        │   │ Consumes: metrics.received event
        │   │ Stores to TimescaleDB (time-series DB)
        │   │
        │   ├─→ TimescaleDB (hypertable):
        │   │   INSERT INTO metrics (isp_id, timestamp, bandwidth, latency, ...)
        │   │   VALUES ('vituIT', 1695891600, 120.5, 45, ...)
        │   │
        │   └─→ Compresses old data automatically
        │
        ├─→ isp-partner-portal (Next.js)
        │   │ WebSocket connection to: /api/ws/metrics/vituIT
        │   │
        │   ├─→ central-api (NestJS)
        │   │   │ GET /metrics/live/vituIT
        │   │   │
        │   │   └─→ metering-service
        │   │       │ GET /metering/live-stream?ispId=vituIT
        │   │       │ Returns: Last 24 hours + real-time updates
        │   │       │
        │   │       └─→ TimescaleDB: SELECT * WHERE isp_id = 'vituIT'
        │   │           ORDER BY timestamp DESC LIMIT 1
        │   │
        │   └─→ Dashboard shows: Real-time graph of bandwidth usage
        │
        ├─→ provisioning-service (NestJS)
        │   │ Watches: metrics.received events
        │   │ Triggers if: bandwidth_in_mbps > committed × 1.5
        │   │
        │   ├─→ Alert: "VituIT exceeding burst capacity"
        │   │
        │   └─→ Action: Automatic traffic shaping or ISP notification
        │
        └─→ financial-dashboard (Next.js)
            │ GET /api/analytics/usage-trending
            │
            ├─→ revenue-service
            │   │ Calculates real-time overage charges
            │   │ "If usage continues, bill will be +$50 this month"
            │   │
            │   └─→ Display: Projected month-end billing
            │
            └─→ Chart updates every 30 seconds
```

---

## **7. BSS/OSS Integration Flow (Scheduled Sync)**

```
Every hour - system-queue triggers sync job
    │
    └─→ bss-oss-sync (infra-service with Hono)
        │ Job: "sync-isp-billing-systems"
        │
        ├─→ For each ISP with Amdocs/Openet integration:
        │   │
        │   ├─→ telco-integrations (package)
        │   │   │ POST /adapters/pull-orders
        │   │   │   Calls: ISP's Openet API
        │   │   │   Endpoint: "https://openet.vituIT.com/api/v2/orders"
        │   │   │   Auth: API key from ISP config
        │   │   │
        │   │   └─→ ISP's Openet returns:
        │   │       [
        │   │         {
        │   │           customerId: "cust_001",
        │   │           orderName: "50 Mbps Business Plan",
        │   │           commitmentMbps: 50,
        │   │           createdAt: "2026-09-15"
        │   │         }
        │   │       ]
        │   │
        │   ├─→ provisioning-service (NestJS)
        │   │   │ POST /provisioning/sync-customer
        │   │   │   Body: { customerId, commitmentMbps }
        │   │   │
        │   │   ├─→ Checks: Is this customer already provisioned?
        │   │   │   Query: SELECT * FROM provisioned_customers
        │   │   │   WHERE isp_id = 'vituIT' AND customer_id = 'cust_001'
        │   │   │
        │   │   └─→ If new: Create provisioning record
        │   │       Trigger network engineer alert
        │   │
        │   └─→ bss-oss-sync (infra-service)
        │       │ POST /adapters/push-usage
        │       │   Calls: ISP's Openet API
        │       │   Endpoint: "https://openet.vituIT.com/api/v2/usage"
        │       │   Body: {
        │       │     customerId: "cust_001",
        │       │     period: "2026-09",
        │       │     actualUsage: 48.5,
        │       │     slaCompliance: 99.8,
        │       │     billableAmount: 245.50
        │       │   }
        │       │
        │       └─→ ISP's Openet receives update
        │           ISP's customer sees: "Usage this month: 48.5 Mbps"
        │           ISP's billing system charges customer based on data
        │
        └─→ event-gateway
            │ Publishes: "bss-oss-sync.completed"
            │ Timestamp: When sync finished
            │
            └─→ admin-dashboard shows:
                "Last sync: 2 hours ago ✓"
                "Data pushed to 47 ISPs"
```

---

## **8. Proof of Reserves Flow (Monthly)**

```
1st of month, 03:00 UTC - system-queue triggers proof generation
    │
    └─→ proof-of-reserves-reporter (hypothetical - missing!)
        │
        ├─→ ledger-service (NestJS)
        │   │ GET /ledger/monthly-report?month=09-2026
        │   │
        │   ├─→ PostgreSQL:
        │   │   Revenue: SUM(credits) = $250,000
        │   │   Costs: SUM(debits) = $80,000
        │   │   By city:
        │   │     Johannesburg: $6,700 × 30 days = $201,000
        │   │     Mombasa: $8,200 × 30 days = $246,000
        │   │
        │   └─→ Report object
        │
        ├─→ revenue-proof-protocol (package)
        │   │ Generate Merkle tree of all ISP payments for the month
        │   │ Leaves: individual ISP payments
        │   │ Root: proof that all payments aggregate to $250K
        │   │
        │   ├─→ crypto (package)
        │   │   │ Hash each leaf: keccak256(ispId, amount, date)
        │   │   │ Build Merkle tree bottom-up
        │   │   │ Sign final root with HSM key
        │   │   │
        │   │   └─→ signature: 0xabcdef...
        │   │
        │   └─→ Returns: { merkleRoot, signature, monthlyTotal }
        │
        ├─→ document-vault (infra-service)
        │   │ POST /vault/store-report
        │   │   Stores JSON report to IPFS (pinned)
        │   │
        │   ├─→ IPFS:
        │   │   {
        │   │     "month": "09-2026",
        │   │     "grossRevenue": 250000,
        │   │     "operatingCosts": 80000,
        │   │     "netRevenue": 170000,
        │   │     "merkleRoot": "0x123abc...",
        │   │     "signature": "0x456def...",
        │   │     "auditedBy": "Big4Auditor Inc.",
        │   │     "ipfsHash": "QmXxxx..."
        │   │   }
        │   │
        │   └─→ IPFS hash: QmXxxx... (immutable)
        │
        ├─→ payment-gateway-adapter (infra-service)
        │   │ POST /blockchain/record-reserves
        │   │   Smart contract: ProofOfReserves.sol
        │   │   recordMonthlyReport(ipfsHash, merkleRoot, signature)
        │   │
        │   ├─→ Blockchain (Polygon):
        │   │   mapping(month => ipfsHash) = QmXxxx...
        │   │   mapping(month => merkleRoot) = 0x123abc...
        │   │
        │   └─→ Emits: ReportRecorded(month, ipfsHash)
        │
        └─→ bondholder-transparency-portal (Next.js)
            │ GET /api/reserves/latest-report
            │
            ├─→ Fetches from blockchain + IPFS
            │   Displays:
            │   - Total revenue: $250K
            │   - Total costs: $80K
            │   - Bond backing: 10.2 months (very safe)
            │   - IPFS link: ipfs://QmXxxx...
            │   - Audited by: Deloitte
            │
            └─→ Bondholder can verify:
                1. Merkle root matches blockchain
                2. Download report from IPFS
                3. Check individual ISP transactions
```

---

## **9. Alert & Notification Flow (Real-Time)**

```
ANY service detects anomaly
    │
    ├─→ Example: metering-service detects packet loss > 5%
    │   │ For: VituIT
    │   │
    │   └─→ event-gateway (infra-service)
    │       │ Publishes: "alert.packet-loss-high"
    │       │ Topic: alerts.critical
    │       │
    │       └─→ Kafka: alerts.critical topic
    │
    ├─→ webhook-engine (infra-service)
    │   │ Consumes: alerts.critical
    │   │
    │   ├─→ Looks up: VituIT's webhook endpoints
    │   │   FROM: isps.webhook_urls
    │   │   WHERE: isp_id = 'vituIT' AND event_type = 'alerts'
    │   │
    │   └─→ POST https://vituIT.com/webhooks/alerts
    │       Headers: X-Signature: hmac-sha256(...)
    │       Body: {
    │         event: "packet_loss_high",
    │         severity: "warning",
    │         ispId: "vituIT",
    │         value: 5.2,
    │         threshold: 5.0,
    │         timestamp: 1695891600,
    │         actionRequired: false
    │       }
    │
    ├─→ isp-partner-portal (Next.js)
    │   │ WebSocket listener: /api/ws/alerts
    │   │
    │   └─→ Displays: "⚠️ Packet loss elevated: 5.2% (threshold: 5%)"
    │
    ├─→ admin-dashboard (Next.js)
    │   │ GET /api/alerts/critical
    │   │
    │   └─→ Shows: "1 critical alert: VituIT packet loss"
    │
    └─→ observability (package)
        │ Logs to: ElasticSearch/Datadog
        │ Alert sent to PagerDuty if severity = critical
        │
        └─→ On-call engineer gets notified
```

---

## **Call Graph Summary**

Here's the dependency graph:

```
┌─────────────────────────────────────────────────────────────┐
│                    APPS (React/Next.js)                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │ ISP Portal   │ │Financial     │ │Bondholder Portal     │ │
│  │              │ │Dashboard     │ │                      │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
           ↓                  ↓                      ↓
┌──────────────────────────────────────────────────────────────┐
│              SERVICES (NestJS Microservices)                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │ revenue-     │ │settlement-   │ │metering-service      │ │
│  │ service      │ │service       │ │                      │ │
│  │              │ │              │ │                      │ │
│  ├──────────────┤ ├──────────────┤ ├──────────────────────┤ │
│  │billing-      │ │provisioning- │ │reconciliation-       │ │
│  │service       │ │service       │ │service               │ │
│  │              │ │              │ │                      │ │
│  ├──────────────┤ ├──────────────┤ ├──────────────────────┤ │
│  │invoicing-    │ │ledger-       │ │central-api           │ │
│  │service       │ │service       │ │                      │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
           ↓                  ↓                      ↓
┌──────────────────────────────────────────────────────────────┐
│        INFRA-SERVICES (Lightweight Hono/EventBus)            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │metrics-      │ │payment-      │ │webhook-engine        │ │
│  │ingestion     │ │gateway-      │ │                      │ │
│  │              │ │adapter       │ │                      │ │
│  ├──────────────┤ ├──────────────┤ ├──────────────────────┤ │
│  │event-        │ │bss-oss-sync  │ │system-queue          │ │
│  │gateway       │ │              │ │(BullMQ/Redis)        │ │
│  │(Kafka)       │ │              │ │                      │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
           ↓                  ↓                      ↓
┌──────────────────────────────────────────────────────────────┐
│                     SHARED PACKAGES                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │billing-      │ │settlement-   │ │revenue-proof-        │ │
│  │domain        │ │domain        │ │protocol              │ │
│  │              │ │              │ │                      │ │
│  ├──────────────┤ ├──────────────┤ ├──────────────────────┤ │
│  │crypto        │ │blockchain-   │ │telco-integrations    │ │
│  │              │ │types         │ │                      │ │
│  │              │ │              │ │                      │ │
│  ├──────────────┤ ├──────────────┤ ├──────────────────────┤ │
│  │marketplace-  │ │ledger-       │ │proto (gRPC)          │ │
│  │types         │ │accounting    │ │                      │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
           ↓                  ↓                      ↓
┌──────────────────────────────────────────────────────────────┐
│          DATA LAYER & EXTERNAL SYSTEMS                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │PostgreSQL    │ │TimescaleDB   │ │Redis                 │ │
│  │(Transactions)│ │(Metrics)     │ │(Cache/Queue)         │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │AWS S3        │ │Kafka         │ │Blockchain (Polygon)  │ │
│  │(Docs/PDFs)   │ │(Event Stream)│ │(Smart Contracts)     │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
│  ┌──────────────┐ ┌──────────────┐                           │
│  │IPFS          │ │External APIs │                           │
│  │(Immutable)   │ │(ISP Systems) │                           │
│  └──────────────┘ └──────────────┘                           │
└──────────────────────────────────────────────────────────────┘
```

---

## **Key Communication Patterns**

### **1. Synchronous (Request-Response)**

- **Apps → Services**: REST/HTTP
  - `GET /api/revenue/monthly-by-isp`
  - `POST /billing/apply-payment`

- **Service → Service**: gRPC (proto package)
  - `revenue-service` → `metering-service` (fetch usage)
  - `settlement-service` → `ledger-service` (record transaction)

### **2. Asynchronous (Event-Driven)**

- **Publisher → Kafka → Subscribers**
  - `payment-gateway-adapter` publishes: `payment.received`
  - Consumed by: `settlement-service`, `billing-service`, `webhook-engine`

- **Job Queue (BullMQ)**
  - `system-queue` enqueues: `generate-monthly-bills`
  - Processed by: `revenue-service`, `invoicing-service`, `ledger-service`

### **3. Real-Time (WebSocket)**

- **Backend → Apps (push)**
  - `metering-service` → `isp-partner-portal`: bandwidth metrics
  - `blockchain` → `bondholder-portal`: revenue attestation updates

### **4. Scheduled (Cron)**

- `00:00 UTC`: Daily revenue attestation
- `01:00 UTC`: Daily reconciliation
- `02:00 UTC`: Monthly payout processing
- `03:00 UTC`: Proof of reserves generation

---

## **Data Flow Timing (Example: One ISP, One Month)**

```
Day 1, 14:30 - VituIT makes $2,000 payment
└─ 14:30: payment-gateway-adapter receives webhook
└─ 14:31: settlement-service records payment
└─ 14:32: ISP portal shows balance updated

Day 1-30, continuous - metrics flowing
└─ Every 5 min: metering-service ingests bandwidth data
└─ Real-time: ISP portal shows bandwidth graph updating

Day 30, 23:59 - Month ends
└─ System waits for midnight UTC

Day 1 (next month), 00:00 - Oracle attestation
└─ 00:00: oracle-service triggers
└─ 00:05: blockchain records daily revenue for Day 30

Day 1, 00:01 - Billing cycle starts
└─ 00:01: system-queue enqueues "generate-monthly-bills"
└─ 00:10: billing-service calculates: $45.50
└─ 00:15: invoicing-service generates PDF
└─ 00:20: ledger-service records invoice
└─ 00:25: webhook-engine notifies VituIT

Day 1, 01:00 - Daily reconciliation
└─ 01:00: reconciliation-service compares measured vs reported
└─ 01:05: status RECONCILED ✓

Day 15, 02:00 - Payout processing
└─ 02:00: system-queue enqueues "process-monthly-payouts"
└─ 02:10: settlement-service calculates: $36.40 payout
└─ 02:15: crypto converts to USDC
└─ 02:20: payment-gateway-adapter sends stablecoin
└─ 02:25: VituIT's wallet receives 36.40 USDC
└─ 02:30: ledger-service records payout
└─ 02:35: webhook-engine notifies VituIT ✓

Day 1 (month+1), 01:00 UTC - Monthly report
└─ 01:00: proof-of-reserves-reporter generates report
└─ 01:15: merkle tree created
└─ 01:20: signed and published to IPFS
└─ 01:25: blockchain records report hash
└─ 01:30: bondholder portal updates ✓
```

This architecture shows **true microservices**: each service owns a domain, communicates via well-defined APIs/events, and can scale independently.
