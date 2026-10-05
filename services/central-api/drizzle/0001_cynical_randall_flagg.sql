CREATE TYPE "public"."account_type" AS ENUM('asset', 'liability', 'revenue', 'expense', 'equity');--> statement-breakpoint
CREATE TYPE "public"."bill_status" AS ENUM('draft', 'issued', 'disputed', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."credit_basis" AS ENUM('sla_shortfall', 'dispute', 'goodwill');--> statement-breakpoint
CREATE TYPE "public"."finance_payout_status" AS ENUM('pending', 'converting', 'sending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payout_method" AS ENUM('bank', 'usdc');--> statement-breakpoint
CREATE TABLE "finance_attestations" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"city" varchar(96) NOT NULL,
	"month" varchar(7) NOT NULL,
	"day" smallint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"gross_minor" bigint NOT NULL,
	"costs_minor" bigint NOT NULL,
	"published_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "finance_attestations_day_in_range" CHECK ("finance_attestations"."day" between 1 and 31),
	CONSTRAINT "finance_attestations_month_format" CHECK ("finance_attestations"."month" ~ '^[0-9]{4}-[0-9]{2}$'),
	CONSTRAINT "finance_attestations_gross_gte_zero" CHECK ("finance_attestations"."gross_minor" >= 0),
	CONSTRAINT "finance_attestations_costs_gte_zero" CHECK ("finance_attestations"."costs_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "finance_bills" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"isp_id" varchar(64) NOT NULL,
	"isp_name" varchar(160) NOT NULL,
	"month" varchar(7) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"committed_mbps" integer NOT NULL,
	"commitment_charge_minor" bigint NOT NULL,
	"overage_charge_minor" bigint NOT NULL,
	"sla_credit_minor" bigint NOT NULL,
	"status" "bill_status" NOT NULL,
	"due_at" timestamp NOT NULL,
	"dispute_reason" text,
	"issued_at" timestamp NOT NULL,
	"settled_minor" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "finance_bills_month_format" CHECK ("finance_bills"."month" ~ '^[0-9]{4}-[0-9]{2}$'),
	CONSTRAINT "finance_bills_sla_credit_lte_zero" CHECK ("finance_bills"."sla_credit_minor" <= 0),
	CONSTRAINT "finance_bills_overage_gte_zero" CHECK ("finance_bills"."overage_charge_minor" >= 0),
	CONSTRAINT "finance_bills_commitment_gte_zero" CHECK ("finance_bills"."commitment_charge_minor" >= 0),
	CONSTRAINT "finance_bills_committed_mbps_gte_zero" CHECK ("finance_bills"."committed_mbps" >= 0),
	CONSTRAINT "finance_bills_settled_gte_zero" CHECK ("finance_bills"."settled_minor" >= 0),
	CONSTRAINT "finance_bills_dispute_reason_iff_disputed" CHECK (("finance_bills"."status" = 'disputed') = ("finance_bills"."dispute_reason" is not null))
);
--> statement-breakpoint
CREATE TABLE "finance_credits" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"bill_id" varchar(64) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"basis" "credit_basis" NOT NULL,
	"note" text NOT NULL,
	"recorded_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "finance_credits_amount_lte_zero" CHECK ("finance_credits"."amount_minor" <= 0)
);
--> statement-breakpoint
CREATE TABLE "finance_ledger_accounts" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"type" "account_type" NOT NULL,
	"currency" varchar(3) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_ledger_entries" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"reference" varchar(128) NOT NULL,
	"description" text NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"currency" varchar(3) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_ledger_postings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "finance_ledger_postings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"entry_id" varchar(64) NOT NULL,
	"account_id" varchar(64) NOT NULL,
	"amount_minor" bigint NOT NULL,
	CONSTRAINT "finance_ledger_postings_amount_ne_zero" CHECK ("finance_ledger_postings"."amount_minor" <> 0)
);
--> statement-breakpoint
CREATE TABLE "finance_payouts" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"isp_id" varchar(64) NOT NULL,
	"isp_name" varchar(160) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"fee_minor" bigint NOT NULL,
	"status" "finance_payout_status" NOT NULL,
	"method" "payout_method" NOT NULL,
	"reference" varchar(96) NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "finance_payouts_amount_gt_zero" CHECK ("finance_payouts"."amount_minor" > 0),
	CONSTRAINT "finance_payouts_fee_gte_zero" CHECK ("finance_payouts"."fee_minor" >= 0),
	CONSTRAINT "finance_payouts_failure_reason_iff_failed" CHECK (("finance_payouts"."status" = 'failed') = ("finance_payouts"."failure_reason" is not null))
);
--> statement-breakpoint
ALTER TABLE "finance_credits" ADD CONSTRAINT "finance_credits_bill_id_finance_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."finance_bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_ledger_postings" ADD CONSTRAINT "finance_ledger_postings_entry_id_finance_ledger_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."finance_ledger_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_ledger_postings" ADD CONSTRAINT "finance_ledger_postings_account_id_finance_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."finance_ledger_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "finance_attestations_city_month_day_uniq" ON "finance_attestations" USING btree ("city","month","day");--> statement-breakpoint
CREATE INDEX "finance_attestations_month_idx" ON "finance_attestations" USING btree ("month");--> statement-breakpoint
CREATE INDEX "finance_attestations_city_idx" ON "finance_attestations" USING btree ("city");--> statement-breakpoint
CREATE INDEX "finance_bills_status_idx" ON "finance_bills" USING btree ("status");--> statement-breakpoint
CREATE INDEX "finance_bills_isp_idx" ON "finance_bills" USING btree ("isp_id");--> statement-breakpoint
CREATE INDEX "finance_bills_month_idx" ON "finance_bills" USING btree ("month");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_bills_isp_month_uniq" ON "finance_bills" USING btree ("isp_id","month");--> statement-breakpoint
CREATE INDEX "finance_credits_bill_idx" ON "finance_credits" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "finance_credits_basis_idx" ON "finance_credits" USING btree ("basis");--> statement-breakpoint
CREATE INDEX "finance_ledger_accounts_type_idx" ON "finance_ledger_accounts" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_ledger_accounts_name_currency_uniq" ON "finance_ledger_accounts" USING btree ("name","currency");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_ledger_entries_reference_uniq" ON "finance_ledger_entries" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "finance_ledger_entries_occurred_idx" ON "finance_ledger_entries" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "finance_ledger_postings_entry_idx" ON "finance_ledger_postings" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "finance_ledger_postings_account_idx" ON "finance_ledger_postings" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "finance_payouts_status_idx" ON "finance_payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "finance_payouts_isp_idx" ON "finance_payouts" USING btree ("isp_id");--> statement-breakpoint
CREATE INDEX "finance_payouts_reference_idx" ON "finance_payouts" USING btree ("reference");