-- Create deletion_request_status enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deletion_request_status') THEN
    CREATE TYPE deletion_request_status AS ENUM ('pending', 'approved', 'denied');
  END IF;
END$$;

-- Create deletion_requests table if not exists
CREATE TABLE IF NOT EXISTS "deletion_requests" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_type" varchar NOT NULL,
  "entity_id" varchar NOT NULL,
  "entity_label" varchar NOT NULL,
  "requested_by" varchar NOT NULL,
  "requested_by_name" varchar NOT NULL,
  "reason" text NOT NULL,
  "status" deletion_request_status NOT NULL DEFAULT 'pending',
  "reviewed_by" varchar,
  "reviewed_at" timestamp,
  "review_note" text,
  "created_at" timestamp DEFAULT now()
);

-- Index for fast pending count lookups
CREATE INDEX IF NOT EXISTS "idx_deletion_requests_status" ON "deletion_requests" ("status");
CREATE INDEX IF NOT EXISTS "idx_deletion_requests_requested_by" ON "deletion_requests" ("requested_by");
