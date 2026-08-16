-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'APPROVER', 'VIEWER');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "MandateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AuthorizationDecision" AS ENUM ('ALLOW', 'DENY', 'REQUIRE_APPROVAL');

-- CreateEnum
CREATE TYPE "AuthorizationState" AS ENUM ('REQUESTED', 'ALLOWED', 'DENIED', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'EXECUTING', 'EXECUTED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'EXECUTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'AGENT', 'SYSTEM');

-- CreateTable
CREATE TABLE "organisations" (
    "id" VARCHAR(40) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" VARCHAR(40) NOT NULL,
    "organisation_id" VARCHAR(40) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" VARCHAR(40) NOT NULL,
    "organisation_id" VARCHAR(40) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "status" "AgentStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_credentials" (
    "id" VARCHAR(40) NOT NULL,
    "agent_id" VARCHAR(40) NOT NULL,
    "key_prefix" VARCHAR(32) NOT NULL,
    "key_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "agent_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mandates" (
    "id" VARCHAR(40) NOT NULL,
    "organisation_id" VARCHAR(40) NOT NULL,
    "agent_id" VARCHAR(40) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "MandateStatus" NOT NULL DEFAULT 'DRAFT',
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "created_by" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "mandates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mandate_capabilities" (
    "mandate_id" VARCHAR(40) NOT NULL,
    "capability" VARCHAR(100) NOT NULL,

    CONSTRAINT "mandate_capabilities_pkey" PRIMARY KEY ("mandate_id","capability")
);

-- CreateTable
CREATE TABLE "spending_policies" (
    "id" VARCHAR(40) NOT NULL,
    "mandate_id" VARCHAR(40) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "allowed_vendors" JSONB NOT NULL,
    "per_transaction_limit_minor" BIGINT NOT NULL,
    "daily_limit_minor" BIGINT NOT NULL,
    "monthly_limit_minor" BIGINT NOT NULL,
    "approval_threshold_minor" BIGINT NOT NULL,

    CONSTRAINT "spending_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authorizations" (
    "id" VARCHAR(40) NOT NULL,
    "organisation_id" VARCHAR(40) NOT NULL,
    "agent_id" VARCHAR(40) NOT NULL,
    "mandate_id" VARCHAR(40),
    "idempotency_key" VARCHAR(200) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "capability" VARCHAR(100) NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "vendor_id" VARCHAR(100) NOT NULL,
    "vendor_name" VARCHAR(160),
    "metadata" JSONB NOT NULL,
    "decision" "AuthorizationDecision" NOT NULL,
    "state" "AuthorizationState" NOT NULL,
    "reason_codes" JSONB NOT NULL,
    "evaluation_trace" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" VARCHAR(40) NOT NULL,
    "organisation_id" VARCHAR(40) NOT NULL,
    "authorization_id" VARCHAR(40) NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "triggered_by" VARCHAR(100) NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),
    "decided_by" VARCHAR(40),
    "comment" VARCHAR(500),

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executions" (
    "id" VARCHAR(40) NOT NULL,
    "organisation_id" VARCHAR(40) NOT NULL,
    "authorization_id" VARCHAR(40) NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "provider" VARCHAR(80) NOT NULL,
    "external_reference" VARCHAR(200),
    "error_code" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" VARCHAR(40) NOT NULL,
    "organisation_id" VARCHAR(40) NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_id" VARCHAR(40),
    "event_type" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(40) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organisations_slug_key" ON "organisations"("slug");

-- CreateIndex
CREATE INDEX "users_organisation_id_role_idx" ON "users"("organisation_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "users_organisation_id_email_key" ON "users"("organisation_id", "email");

-- CreateIndex
CREATE INDEX "agents_organisation_id_status_idx" ON "agents"("organisation_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agents_organisation_id_slug_key" ON "agents"("organisation_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "agent_credentials_key_hash_key" ON "agent_credentials"("key_hash");

-- CreateIndex
CREATE INDEX "agent_credentials_agent_id_revoked_at_idx" ON "agent_credentials"("agent_id", "revoked_at");

-- CreateIndex
CREATE INDEX "mandates_organisation_id_status_idx" ON "mandates"("organisation_id", "status");

-- CreateIndex
CREATE INDEX "mandates_agent_id_status_valid_from_valid_until_idx" ON "mandates"("agent_id", "status", "valid_from", "valid_until");

-- CreateIndex
CREATE UNIQUE INDEX "mandates_agent_id_name_version_key" ON "mandates"("agent_id", "name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "spending_policies_mandate_id_key" ON "spending_policies"("mandate_id");

-- CreateIndex
CREATE INDEX "authorizations_organisation_id_created_at_idx" ON "authorizations"("organisation_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "authorizations_agent_id_currency_state_created_at_idx" ON "authorizations"("agent_id", "currency", "state", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "authorizations_agent_id_idempotency_key_key" ON "authorizations"("agent_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "approval_requests_authorization_id_key" ON "approval_requests"("authorization_id");

-- CreateIndex
CREATE INDEX "approval_requests_organisation_id_status_requested_at_idx" ON "approval_requests"("organisation_id", "status", "requested_at");

-- CreateIndex
CREATE UNIQUE INDEX "executions_authorization_id_key" ON "executions"("authorization_id");

-- CreateIndex
CREATE INDEX "executions_organisation_id_created_at_idx" ON "executions"("organisation_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_events_organisation_id_timestamp_idx" ON "audit_events"("organisation_id", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "audit_events_organisation_id_event_type_timestamp_idx" ON "audit_events"("organisation_id", "event_type", "timestamp" DESC);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_credentials" ADD CONSTRAINT "agent_credentials_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mandates" ADD CONSTRAINT "mandates_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mandates" ADD CONSTRAINT "mandates_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mandates" ADD CONSTRAINT "mandates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mandate_capabilities" ADD CONSTRAINT "mandate_capabilities_mandate_id_fkey" FOREIGN KEY ("mandate_id") REFERENCES "mandates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spending_policies" ADD CONSTRAINT "spending_policies_mandate_id_fkey" FOREIGN KEY ("mandate_id") REFERENCES "mandates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorizations" ADD CONSTRAINT "authorizations_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorizations" ADD CONSTRAINT "authorizations_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorizations" ADD CONSTRAINT "authorizations_mandate_id_fkey" FOREIGN KEY ("mandate_id") REFERENCES "mandates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_authorization_id_fkey" FOREIGN KEY ("authorization_id") REFERENCES "authorizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_authorization_id_fkey" FOREIGN KEY ("authorization_id") REFERENCES "authorizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Security invariants that Prisma's schema language cannot express directly.
ALTER TABLE "mandates"
  ADD CONSTRAINT "mandates_valid_window_check" CHECK ("valid_from" < "valid_until");

ALTER TABLE "spending_policies"
  ADD CONSTRAINT "spending_policies_limits_check" CHECK (
    "per_transaction_limit_minor" > 0
    AND "per_transaction_limit_minor" <= "daily_limit_minor"
    AND "daily_limit_minor" <= "monthly_limit_minor"
    AND "approval_threshold_minor" >= 0
    AND "approval_threshold_minor" <= "per_transaction_limit_minor"
  );

ALTER TABLE "spending_policies"
  ADD CONSTRAINT "spending_policies_vendors_array_check" CHECK (jsonb_typeof("allowed_vendors") = 'array');

ALTER TABLE "authorizations"
  ADD CONSTRAINT "authorizations_positive_amount_check" CHECK ("amount_minor" > 0);

CREATE UNIQUE INDEX "mandates_one_active_per_agent"
  ON "mandates"("agent_id")
  WHERE "status" = 'ACTIVE';

CREATE OR REPLACE FUNCTION capyn_prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'CAPYN audit events are append-only';
END;
$$;

CREATE TRIGGER "audit_events_append_only"
BEFORE UPDATE OR DELETE ON "audit_events"
FOR EACH ROW EXECUTE FUNCTION capyn_prevent_audit_mutation();
