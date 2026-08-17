ALTER TABLE "executions"
  ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "last_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "lease_expires_at" TIMESTAMP(3);

UPDATE "executions"
SET "lease_expires_at" = "created_at"
WHERE "status" = 'PENDING';

CREATE INDEX "executions_status_lease_expires_at_idx"
  ON "executions"("status", "lease_expires_at");
