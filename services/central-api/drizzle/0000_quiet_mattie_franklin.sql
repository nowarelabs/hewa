CREATE TYPE "public"."alert_category" AS ENUM('sla', 'capacity', 'outage', 'billing', 'security');--> statement-breakpoint
CREATE TYPE "public"."alert_severity" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."market_pool" AS ENUM('nairobi_ixp', 'mombasa_corridor', 'east_africa_subsea', 'cdn_edge');--> statement-breakpoint
CREATE TYPE "public"."market_side" AS ENUM('bid', 'offer');--> statement-breakpoint
CREATE TYPE "public"."node_kind" AS ENUM('data_center', 'metro_fiber', 'long_haul_fiber', 'ixp', 'subsea_cable', 'cdn_edge');--> statement-breakpoint
CREATE TYPE "public"."node_status" AS ENUM('operational', 'degraded', 'maintenance', 'offline');--> statement-breakpoint
CREATE TYPE "public"."settlement_kind" AS ENUM('clearing', 'micro_payment', 'escrow', 'payout');--> statement-breakpoint
CREATE TYPE "public"."sla_state" AS ENUM('compliant', 'at_risk', 'breached');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'reversed');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"category" "alert_category" NOT NULL,
	"severity" "alert_severity" NOT NULL,
	"entity_id" varchar(64) NOT NULL,
	"entity_label" varchar(160) NOT NULL,
	"provider" varchar(128) NOT NULL,
	"city" varchar(96) NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"impacted_gbps" integer NOT NULL,
	"affected_slas" integer NOT NULL,
	"automated_action" text,
	"raised_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "alerts_impacted_gte_zero" CHECK ("alerts"."impacted_gbps" >= 0),
	CONSTRAINT "alerts_affected_slas_gte_zero" CHECK ("alerts"."affected_slas" >= 0)
);
--> statement-breakpoint
CREATE TABLE "infrastructure_nodes" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"kind" "node_kind" NOT NULL,
	"provider" varchar(128) NOT NULL,
	"city" varchar(96) NOT NULL,
	"country" varchar(96) NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"capacity_gbps" integer NOT NULL,
	"utilisation_bps" integer NOT NULL,
	"status" "node_status" NOT NULL,
	"observed_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "infrastructure_nodes_bps_in_range" CHECK ("infrastructure_nodes"."utilisation_bps" between 0 and 10000),
	CONSTRAINT "infrastructure_nodes_capacity_gte_zero" CHECK ("infrastructure_nodes"."capacity_gbps" >= 0)
);
--> statement-breakpoint
CREATE TABLE "market_orders" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"pool" "market_pool" NOT NULL,
	"side" "market_side" NOT NULL,
	"provider" varchar(128) NOT NULL,
	"committed_gbps" integer NOT NULL,
	"burst_gbps" integer NOT NULL,
	"price_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"submitted_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "market_orders_burst_gte_committed" CHECK ("market_orders"."burst_gbps" >= "market_orders"."committed_gbps"),
	CONSTRAINT "market_orders_committed_gte_zero" CHECK ("market_orders"."committed_gbps" >= 0)
);
--> statement-breakpoint
CREATE TABLE "market_spots" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "market_spots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"pool" "market_pool" NOT NULL,
	"price_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"observed_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"batch" varchar(64) NOT NULL,
	"kind" "settlement_kind" NOT NULL,
	"status" "transaction_status" NOT NULL,
	"counterparty" varchar(128) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"fee_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "settlements_fee_gte_zero" CHECK ("settlements"."fee_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sla_monitors" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"account" varchar(128) NOT NULL,
	"node_id" varchar(64) NOT NULL,
	"node_name" varchar(160) NOT NULL,
	"provider" varchar(128) NOT NULL,
	"target_bps" integer NOT NULL,
	"actual_bps" integer NOT NULL,
	"credit_numerator" integer NOT NULL,
	"credit_denominator" integer NOT NULL,
	"packet_loss_ppm" integer NOT NULL,
	"latency_p95_ms" integer NOT NULL,
	"state" "sla_state" NOT NULL,
	"measured_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sla_monitors_target_in_range" CHECK ("sla_monitors"."target_bps" between 0 and 10000),
	CONSTRAINT "sla_monitors_actual_in_range" CHECK ("sla_monitors"."actual_bps" between 0 and 10000),
	CONSTRAINT "sla_monitors_ppm_in_range" CHECK ("sla_monitors"."packet_loss_ppm" between 0 and 1000000),
	CONSTRAINT "sla_monitors_credit_denominator_gt_zero" CHECK ("sla_monitors"."credit_denominator" > 0),
	CONSTRAINT "sla_monitors_credit_numerator_gte_zero" CHECK ("sla_monitors"."credit_numerator" >= 0)
);
--> statement-breakpoint
ALTER TABLE "sla_monitors" ADD CONSTRAINT "sla_monitors_node_id_infrastructure_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."infrastructure_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_severity_idx" ON "alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "alerts_category_idx" ON "alerts" USING btree ("category");--> statement-breakpoint
CREATE INDEX "infrastructure_nodes_kind_idx" ON "infrastructure_nodes" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "market_orders_pool_idx" ON "market_orders" USING btree ("pool");--> statement-breakpoint
CREATE INDEX "market_orders_side_idx" ON "market_orders" USING btree ("side");--> statement-breakpoint
CREATE INDEX "market_spots_pool_observed_idx" ON "market_spots" USING btree ("pool","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "market_spots_pool_observed_uniq" ON "market_spots" USING btree ("pool","observed_at");--> statement-breakpoint
CREATE INDEX "settlements_kind_idx" ON "settlements" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "settlements_batch_idx" ON "settlements" USING btree ("batch");--> statement-breakpoint
CREATE INDEX "sla_monitors_state_idx" ON "sla_monitors" USING btree ("state");--> statement-breakpoint
CREATE INDEX "sla_monitors_node_idx" ON "sla_monitors" USING btree ("node_id");