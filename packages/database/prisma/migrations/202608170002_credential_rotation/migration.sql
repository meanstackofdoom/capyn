ALTER TABLE "agent_credentials"
  ADD COLUMN "rotation_idempotency_key" VARCHAR(200),
  ADD COLUMN "rotated_from_id" VARCHAR(40);

CREATE UNIQUE INDEX "agent_credentials_agent_id_rotation_idempotency_key_key"
  ON "agent_credentials"("agent_id", "rotation_idempotency_key");

CREATE INDEX "agent_credentials_rotated_from_id_idx"
  ON "agent_credentials"("rotated_from_id");

ALTER TABLE "agent_credentials"
  ADD CONSTRAINT "agent_credentials_rotated_from_id_fkey"
  FOREIGN KEY ("rotated_from_id") REFERENCES "agent_credentials"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
