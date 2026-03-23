-- Migration: Work Order Status Rationalization (Task #48)
-- Converts old WO status set to new model and adds isDelayed boolean flag.
--
-- Old statuses: Inactive, Draft, Scheduled, Completed, Cancelled, Delayed
-- New statuses: Draft, AtVendor, ReadyToSchedule, Scheduled, Completed, Cancelled
-- Delayed converted to isDelayed boolean flag on the work_orders table.
--
-- This migration is safe to run multiple times (idempotent).

-- Step 1: Add new enum values if not already present
DO $$ BEGIN
  ALTER TYPE wo_status ADD VALUE IF NOT EXISTS 'AtVendor';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE wo_status ADD VALUE IF NOT EXISTS 'ReadyToSchedule';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Step 2: Add is_delayed column if not already present
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS is_delayed boolean NOT NULL DEFAULT false;

-- Step 3: Backfill is_delayed for records that were Delayed
UPDATE work_orders
SET
  is_delayed = true,
  status = COALESCE(previous_status::wo_status, 'Draft'::wo_status)
WHERE status = 'Delayed';

-- Step 4: Migrate Inactive -> Draft
UPDATE work_orders
SET status = 'Draft'
WHERE status = 'Inactive';

-- Step 5: Set default for status column to Draft
ALTER TABLE work_orders
  ALTER COLUMN status SET DEFAULT 'Draft';
