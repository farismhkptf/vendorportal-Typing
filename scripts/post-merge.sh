#!/bin/bash
set -e
npm install

# Run incremental SQL migrations
psql "$DATABASE_URL" -f migrations/0001_add_assigned_to_user_id_to_typing_jobs.sql 2>/dev/null || true

# Task #56: Attestation inquiry flow columns
psql "$DATABASE_URL" <<'SQL' 2>/dev/null || true
ALTER TABLE attestation_inquiries ADD COLUMN IF NOT EXISTS created_by VARCHAR REFERENCES users(id);
ALTER TABLE attestation_inquiries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE attestation_service_requests ADD COLUMN IF NOT EXISTS fee_source TEXT;
ALTER TABLE attestation_service_requests ADD COLUMN IF NOT EXISTS service_name TEXT;
ALTER TABLE attestation_service_requests ADD COLUMN IF NOT EXISTS service_notes TEXT;
ALTER TABLE attestation_service_requests ADD COLUMN IF NOT EXISTS service_fee_aed NUMERIC(10,2);
ALTER TABLE attestation_service_requests ADD COLUMN IF NOT EXISTS created_by VARCHAR REFERENCES users(id);
ALTER TABLE attestation_inquiry_quotes ADD COLUMN IF NOT EXISTS submitted_by_vendor_user_id VARCHAR REFERENCES users(id);
SQL

yes | npm run db:push --force
