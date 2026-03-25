ALTER TABLE "service_types" ADD COLUMN IF NOT EXISTS "requires_attestation" boolean NOT NULL DEFAULT false;
