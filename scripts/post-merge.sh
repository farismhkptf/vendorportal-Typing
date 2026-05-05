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

# Task #57: Document custody chain columns and tables
psql "$DATABASE_URL" <<'SQL' 2>/dev/null || true
ALTER TABLE attestation_service_requests ADD COLUMN IF NOT EXISTS sr_number VARCHAR(20) UNIQUE;
ALTER TABLE attestation_service_requests ADD COLUMN IF NOT EXISTS inquiry_id VARCHAR;
ALTER TABLE attestation_service_requests ADD COLUMN IF NOT EXISTS document_name TEXT;
ALTER TABLE attestation_service_requests ADD COLUMN IF NOT EXISTS assigned_pro_id VARCHAR;
ALTER TABLE attestation_service_requests ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE attestation_service_requests ADD COLUMN IF NOT EXISTS document_type TEXT;
ALTER TABLE attestation_service_requests ADD COLUMN IF NOT EXISTS document_name_description TEXT;
ALTER TABLE attestation_service_requests ADD COLUMN IF NOT EXISTS home_country TEXT;
ALTER TABLE attestation_service_requests ADD COLUMN IF NOT EXISTS original_document_involved BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE attestation_service_requests ADD COLUMN IF NOT EXISTS internal_notes TEXT;

DO $$ BEGIN
  CREATE TYPE attestation_inquiry_status AS ENUM ('Open', 'QuoteReceived', 'Accepted', 'Rejected', 'Converted');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE attestation_document_class AS ENUM ('Personal', 'Business');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE handover_direction AS ENUM ('ClientToUs', 'UsToVendor', 'VendorToUs', 'UsToClient');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE physical_custody_status AS ENUM ('WithClient', 'WithUs', 'WithVendor', 'ReturnedToClient');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS attestation_inquiries (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id VARCHAR NOT NULL,
  applicant_name TEXT,
  vendor_id VARCHAR NOT NULL,
  document_type TEXT NOT NULL,
  document_name_description TEXT NOT NULL,
  document_class attestation_document_class NOT NULL,
  home_country TEXT,
  description_of_need TEXT NOT NULL,
  external_wo_number TEXT,
  status attestation_inquiry_status NOT NULL DEFAULT 'Open',
  rejection_reason TEXT,
  converted_to_sr_id VARCHAR,
  created_by VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attestation_inquiry_quotes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id VARCHAR NOT NULL,
  vendor_id VARCHAR NOT NULL,
  submitted_by_vendor_user_id VARCHAR,
  quote_version INTEGER NOT NULL DEFAULT 1,
  amount_aed INTEGER NOT NULL,
  timeline_days INTEGER NOT NULL,
  notes TEXT,
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_custody_log (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  sr_id VARCHAR NOT NULL,
  handover_direction handover_direction NOT NULL,
  counterparty_name TEXT NOT NULL,
  counterparty_contact TEXT NOT NULL,
  counterparty_id_photo_url TEXT,
  counterparty_signature_url TEXT NOT NULL,
  approver_name TEXT,
  approver_contact TEXT,
  approver_designation TEXT,
  receiving_staff_name TEXT,
  receiving_staff_signature_url TEXT,
  recorded_by VARCHAR NOT NULL,
  notes TEXT,
  acknowledged_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attestation_sr_assigned_pro_id ON attestation_service_requests(assigned_pro_id);
CREATE INDEX IF NOT EXISTS idx_attestation_inquiries_company_id ON attestation_inquiries(company_id);
CREATE INDEX IF NOT EXISTS idx_attestation_inquiries_vendor_id ON attestation_inquiries(vendor_id);
CREATE INDEX IF NOT EXISTS idx_attestation_inquiries_status ON attestation_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_attestation_quotes_inquiry_id ON attestation_inquiry_quotes(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_document_custody_log_sr_id ON document_custody_log(sr_id);
SQL

# Task #62: Document Custody Lifecycle Module
psql "$DATABASE_URL" <<'SQL' 2>/dev/null || true
DO $$ BEGIN
  CREATE TYPE custody_doc_category AS ENUM ('MofaPersonal', 'MofaBusiness', 'LawyerAttestation', 'EmbassyAttestation');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE custody_doc_subtype AS ENUM (
    'BirthCertificate', 'MarriageCertificate', 'EmbassyAffidavit', 'AcademicCertificate',
    'PersonalPOA', 'TradeLicense', 'MOA', 'BusinessPOA', 'InternalCompanyDocuments',
    'PassportCopy', 'ResidencyCopy', 'UtilityBill', 'Other'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE custody_doc_stage AS ENUM ('WithClient', 'WithUs', 'WithVendor', 'ReturnedToClient');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS document_custody_records (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number VARCHAR(20) NOT NULL UNIQUE,
  company_id VARCHAR NOT NULL,
  wo_id VARCHAR,
  sr_id VARCHAR,
  doc_category custody_doc_category NOT NULL,
  doc_subtype custody_doc_subtype NOT NULL,
  doc_custom_name TEXT,
  custody_stage custody_doc_stage NOT NULL DEFAULT 'WithClient',
  notify_email TEXT,
  notes TEXT,
  created_by VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_custody_handoffs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id VARCHAR NOT NULL,
  from_stage custody_doc_stage NOT NULL,
  to_stage custody_doc_stage NOT NULL,
  counterparty_name TEXT NOT NULL,
  counterparty_contact TEXT NOT NULL,
  counterparty_id_photo_url TEXT,
  notes TEXT,
  performed_by VARCHAR NOT NULL,
  performed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_custody_records_company_id ON document_custody_records(company_id);
CREATE INDEX IF NOT EXISTS idx_doc_custody_records_wo_id ON document_custody_records(wo_id);
CREATE INDEX IF NOT EXISTS idx_doc_custody_records_sr_id ON document_custody_records(sr_id);
CREATE INDEX IF NOT EXISTS idx_doc_custody_handoffs_record_id ON document_custody_handoffs(record_id);
SQL

# Vendor portal files table (vendor schema)
psql "$DATABASE_URL" <<'SQL' 2>/dev/null || true
CREATE SCHEMA IF NOT EXISTS vendor;

DO $$ BEGIN
  CREATE TYPE vendor.file_direction AS ENUM ('Input', 'Output');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE vendor.uploaded_by_type AS ENUM ('Internal', 'Vendor');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS vendor.files (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  related_type TEXT NOT NULL,
  related_id VARCHAR NOT NULL,
  direction vendor.file_direction NOT NULL,
  workdrive_file_id TEXT,
  workdrive_link TEXT,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  uploaded_by_type vendor.uploaded_by_type NOT NULL,
  uploaded_by_user_id VARCHAR,
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_files_related_id ON vendor.files(related_id);
SQL
