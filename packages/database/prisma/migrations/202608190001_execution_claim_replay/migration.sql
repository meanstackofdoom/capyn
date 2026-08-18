CREATE TABLE "execution_claim_consumptions" (
  "namespace" VARCHAR(240) NOT NULL,
  "claim_id" CHAR(64) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "execution_claim_consumptions_pkey" PRIMARY KEY ("namespace", "claim_id")
);

CREATE INDEX "execution_claim_consumptions_expires_at_idx"
  ON "execution_claim_consumptions"("expires_at");
