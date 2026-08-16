CREATE TYPE "BillingPlan" AS ENUM ('DEVELOPER', 'TEAM', 'BUSINESS', 'ENTERPRISE', 'DESIGN_PARTNER');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'UNPAID', 'PAUSED');
CREATE TYPE "BillingProviderName" AS ENUM ('INTERNAL', 'MANUAL', 'STRIPE');
CREATE TYPE "BillableMetric" AS ENUM ('AUTHORIZATION_DECISION', 'APPROVAL_REQUEST', 'ACTIVE_AGENT', 'AUDIT_EVENT', 'INTEGRATION_CONNECTION');

CREATE TABLE "organisation_subscriptions" (
  "id" VARCHAR(40) NOT NULL,
  "organisation_id" VARCHAR(40) NOT NULL,
  "plan" "BillingPlan" NOT NULL DEFAULT 'DEVELOPER',
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "provider" "BillingProviderName" NOT NULL DEFAULT 'INTERNAL',
  "provider_customer_id" VARCHAR(255),
  "provider_subscription_id" VARCHAR(255),
  "current_period_start" TIMESTAMP(3) NOT NULL,
  "current_period_end" TIMESTAMP(3) NOT NULL,
  "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organisation_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "billing_usage_events" (
  "id" VARCHAR(40) NOT NULL,
  "organisation_id" VARCHAR(40) NOT NULL,
  "metric" "BillableMetric" NOT NULL,
  "quantity" BIGINT NOT NULL,
  "source_type" VARCHAR(80) NOT NULL,
  "source_id" VARCHAR(80) NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "provider_reported_at" TIMESTAMP(3),
  "metadata" JSONB NOT NULL,
  CONSTRAINT "billing_usage_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "billing_webhook_events" (
  "id" VARCHAR(40) NOT NULL,
  "provider" "BillingProviderName" NOT NULL,
  "provider_event_id" VARCHAR(255) NOT NULL,
  "event_type" VARCHAR(160) NOT NULL,
  "payload_hash" CHAR(64) NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  CONSTRAINT "billing_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organisation_subscriptions_organisation_id_key" ON "organisation_subscriptions"("organisation_id");
CREATE UNIQUE INDEX "organisation_subscriptions_provider_customer_id_key" ON "organisation_subscriptions"("provider_customer_id");
CREATE UNIQUE INDEX "organisation_subscriptions_provider_subscription_id_key" ON "organisation_subscriptions"("provider_subscription_id");
CREATE INDEX "organisation_subscriptions_plan_status_idx" ON "organisation_subscriptions"("plan", "status");
CREATE UNIQUE INDEX "billing_usage_events_organisation_id_metric_source_type_source_id_key" ON "billing_usage_events"("organisation_id", "metric", "source_type", "source_id");
CREATE INDEX "billing_usage_events_organisation_id_metric_occurred_at_idx" ON "billing_usage_events"("organisation_id", "metric", "occurred_at");
CREATE UNIQUE INDEX "billing_webhook_events_provider_provider_event_id_key" ON "billing_webhook_events"("provider", "provider_event_id");
CREATE INDEX "billing_webhook_events_provider_received_at_idx" ON "billing_webhook_events"("provider", "received_at");

ALTER TABLE "organisation_subscriptions"
  ADD CONSTRAINT "organisation_subscriptions_organisation_id_fkey"
  FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "billing_usage_events"
  ADD CONSTRAINT "billing_usage_events_organisation_id_fkey"
  FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "organisation_subscriptions"
  ADD CONSTRAINT "organisation_subscriptions_valid_period_check"
  CHECK ("current_period_end" > "current_period_start");

ALTER TABLE "billing_usage_events"
  ADD CONSTRAINT "billing_usage_events_positive_quantity_check"
  CHECK ("quantity" > 0);

INSERT INTO "organisation_subscriptions" (
  "id",
  "organisation_id",
  "plan",
  "status",
  "provider",
  "current_period_start",
  "current_period_end",
  "updated_at"
)
SELECT
  'sub_' || substr(md5("id"), 1, 32),
  "id",
  'DEVELOPER'::"BillingPlan",
  'ACTIVE'::"SubscriptionStatus",
  'INTERNAL'::"BillingProviderName",
  date_trunc('month', CURRENT_TIMESTAMP),
  date_trunc('month', CURRENT_TIMESTAMP) + interval '1 month',
  CURRENT_TIMESTAMP
FROM "organisations";
