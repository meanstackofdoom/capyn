-- Durable owner access credentials are stored only as HMAC digests.
CREATE TABLE "user_credentials" (
    "id" VARCHAR(40) NOT NULL,
    "user_id" VARCHAR(40) NOT NULL,
    "key_prefix" VARCHAR(32) NOT NULL,
    "key_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    CONSTRAINT "user_credentials_pkey" PRIMARY KEY ("id")
);

-- One launch record binds an expiring sandbox credential to exactly one
-- durable organisation, owner, agent, mandate, and credential pair.
CREATE TABLE "production_launches" (
    "id" VARCHAR(40) NOT NULL,
    "sandbox_credential_hash" CHAR(64) NOT NULL,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "organisation_id" VARCHAR(40) NOT NULL,
    "owner_id" VARCHAR(40) NOT NULL,
    "agent_id" VARCHAR(40) NOT NULL,
    "mandate_id" VARCHAR(40) NOT NULL,
    "owner_credential_id" VARCHAR(40) NOT NULL,
    "agent_credential_id" VARCHAR(40) NOT NULL,
    "mandate_valid_until" TIMESTAMP(3) NOT NULL,
    "plan_intent" "BillingPlan" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "production_launches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_credentials_key_hash_key" ON "user_credentials"("key_hash");
CREATE INDEX "user_credentials_user_id_revoked_at_idx" ON "user_credentials"("user_id", "revoked_at");

CREATE UNIQUE INDEX "production_launches_sandbox_credential_hash_key" ON "production_launches"("sandbox_credential_hash");
CREATE INDEX "production_launches_idempotency_key_idx" ON "production_launches"("idempotency_key");
CREATE UNIQUE INDEX "production_launches_organisation_id_key" ON "production_launches"("organisation_id");
CREATE UNIQUE INDEX "production_launches_owner_id_key" ON "production_launches"("owner_id");
CREATE UNIQUE INDEX "production_launches_agent_id_key" ON "production_launches"("agent_id");
CREATE UNIQUE INDEX "production_launches_mandate_id_key" ON "production_launches"("mandate_id");
CREATE UNIQUE INDEX "production_launches_owner_credential_id_key" ON "production_launches"("owner_credential_id");
CREATE UNIQUE INDEX "production_launches_agent_credential_id_key" ON "production_launches"("agent_credential_id");
CREATE INDEX "production_launches_plan_intent_created_at_idx" ON "production_launches"("plan_intent", "created_at");

ALTER TABLE "user_credentials"
  ADD CONSTRAINT "user_credentials_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "production_launches"
  ADD CONSTRAINT "production_launches_organisation_id_fkey"
  FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "production_launches"
  ADD CONSTRAINT "production_launches_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "production_launches"
  ADD CONSTRAINT "production_launches_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "production_launches"
  ADD CONSTRAINT "production_launches_mandate_id_fkey"
  FOREIGN KEY ("mandate_id") REFERENCES "mandates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "production_launches"
  ADD CONSTRAINT "production_launches_owner_credential_id_fkey"
  FOREIGN KEY ("owner_credential_id") REFERENCES "user_credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "production_launches"
  ADD CONSTRAINT "production_launches_agent_credential_id_fkey"
  FOREIGN KEY ("agent_credential_id") REFERENCES "agent_credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
