-- Migration: Appointment action buttons overhaul (Task #116)
-- Adds cancel reason, reschedule reason, email send log, and card viewed timestamp

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS reschedule_reason text,
  ADD COLUMN IF NOT EXISTS email_send_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS card_viewed_at timestamp;
