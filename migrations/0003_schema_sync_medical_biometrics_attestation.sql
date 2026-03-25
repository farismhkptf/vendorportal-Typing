-- Schema Sync Migration: Medical/Biometrics Scheduling + Attestation Module + Deletion Requests
-- Applies all missing tables and columns that were defined in code but absent from the database.
-- Safe to re-run (uses IF NOT EXISTS / DO EXCEPTION patterns).

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Work Orders: add is_delayed column
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS is_delayed BOOLEAN NOT NULL DEFAULT false;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Medical Scheduling enum types
-- ──────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE medical_appt_status AS ENUM (
    'SCHEDULED', 'AWAITING_MEETING', 'IN_PROCESS', 'COMPLETED',
    'RESULT_DELAYED', 'RESULT_ISSUED', 'MEDICAL_FAILED',
    'NO_SHOW', 'RETEST_REQUIRED', 'CLOSED_ADMIN_OVERRIDE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cycle_type AS ENUM ('Initial', 'Reschedule', 'Retest');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cycle_outcome AS ENUM ('Passed', 'Failed', 'Pending');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE medical_event_type AS ENUM (
    'CYCLE_CREATED', 'STATUS_CHANGED', 'QR_CONFIRMED', 'MANUAL_CONFIRMED',
    'CRM_HOLD_SET', 'CRM_HOLD_REMOVED', 'COMPLETED_MARKED', 'RETEST_REQUIRED_SET',
    'ADMIN_OVERRIDE', 'RESULT_ISSUED', 'MEDICAL_FAILED', 'TIMER_AWAITING_MEETING',
    'TIMER_NO_SHOW', 'TIMER_RESULT_DELAYED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Medical Scheduling tables
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_cases (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_id VARCHAR NOT NULL UNIQUE,
  is_open BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_medical_cases_wo_id ON medical_cases(wo_id);

CREATE TABLE IF NOT EXISTS appointment_cycles (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id VARCHAR NOT NULL,
  cycle_number INTEGER NOT NULL DEFAULT 1,
  cycle_type cycle_type NOT NULL DEFAULT 'Initial',
  status medical_appt_status NOT NULL DEFAULT 'SCHEDULED',
  appointment_time TIMESTAMP NOT NULL,
  center_id VARCHAR,
  assigned_pro_id VARCHAR,
  outcome cycle_outcome,
  awaiting_meeting_at TIMESTAMP,
  no_show_at TIMESTAMP,
  completed_at TIMESTAMP,
  result_delayed_at TIMESTAMP,
  result_issued_at TIMESTAMP,
  crm_hold_active BOOLEAN NOT NULL DEFAULT false,
  crm_hold_set_by VARCHAR,
  crm_hold_set_at TIMESTAMP,
  confirmed_at TIMESTAMP,
  confirmed_by VARCHAR,
  confirm_method TEXT,
  override_reason TEXT,
  override_by VARCHAR,
  override_at TIMESTAMP,
  created_by VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_appointment_cycles_case_id ON appointment_cycles(case_id);

CREATE TABLE IF NOT EXISTS medical_appointment_events (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id VARCHAR NOT NULL,
  event_type medical_event_type NOT NULL,
  actor_id VARCHAR,
  actor_role TEXT,
  details JSON,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_medical_events_cycle_id ON medical_appointment_events(cycle_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. EID Biometrics Scheduling enum types
-- ──────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE biometrics_appt_status AS ENUM (
    'SCHEDULED', 'AWAITING_MEETING', 'IN_PROCESS', 'COMPLETED',
    'NO_SHOW', 'RESCHEDULE_REQUIRED', 'CLOSED_ADMIN_OVERRIDE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE biometrics_cycle_type AS ENUM ('Initial', 'Reschedule');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE biometrics_cycle_outcome AS ENUM ('Completed', 'NoShow', 'Pending');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE biometrics_event_type AS ENUM (
    'CYCLE_CREATED', 'STATUS_CHANGED', 'QR_CONFIRMED', 'MANUAL_CONFIRMED',
    'CRM_HOLD_SET', 'CRM_HOLD_REMOVED', 'COMPLETED_MARKED', 'PROOF_UPLOADED',
    'RESCHEDULE_REQUIRED_SET', 'ADMIN_OVERRIDE', 'TIMER_AWAITING_MEETING', 'TIMER_NO_SHOW'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. EID Biometrics Scheduling tables
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biometrics_cases (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_id VARCHAR NOT NULL UNIQUE,
  is_open BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_biometrics_cases_wo_id ON biometrics_cases(wo_id);

CREATE TABLE IF NOT EXISTS biometrics_appointment_cycles (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id VARCHAR NOT NULL,
  cycle_number INTEGER NOT NULL DEFAULT 1,
  cycle_type biometrics_cycle_type NOT NULL DEFAULT 'Initial',
  status biometrics_appt_status NOT NULL DEFAULT 'SCHEDULED',
  appointment_time TIMESTAMP NOT NULL,
  center_id VARCHAR,
  assigned_pro_id VARCHAR,
  outcome biometrics_cycle_outcome,
  awaiting_meeting_at TIMESTAMP,
  no_show_at TIMESTAMP,
  completed_at TIMESTAMP,
  crm_hold_active BOOLEAN NOT NULL DEFAULT false,
  crm_hold_set_by VARCHAR,
  crm_hold_set_at TIMESTAMP,
  confirmed_at TIMESTAMP,
  confirmed_by VARCHAR,
  confirm_method TEXT,
  proof_image_url TEXT,
  proof_uploaded_at TIMESTAMP,
  override_reason TEXT,
  override_by VARCHAR,
  override_at TIMESTAMP,
  created_by VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_biometrics_cycles_case_id ON biometrics_appointment_cycles(case_id);

CREATE TABLE IF NOT EXISTS biometrics_appointment_events (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id VARCHAR NOT NULL,
  event_type biometrics_event_type NOT NULL,
  actor_id VARCHAR,
  actor_role TEXT,
  details JSON,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_biometrics_events_cycle_id ON biometrics_appointment_events(cycle_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. Deletion Requests
-- ──────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE deletion_request_status AS ENUM ('pending', 'approved', 'denied');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS deletion_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_label TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  requested_by_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  status deletion_request_status NOT NULL DEFAULT 'pending',
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  review_note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 7. Attestation Module enum types
-- ──────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE vendor_type AS ENUM ('Typing', 'Attestation');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE attestation_category AS ENUM ('MofaUAE', 'MofaHomeCountry', 'Embassy', 'Lawyer', 'Other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE document_class AS ENUM ('Personal', 'Business', 'Both');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sr_status AS ENUM ('Draft', 'SentToVendor', 'AcceptedByVendor', 'InProgress', 'Completed', 'Cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE physical_custody_status AS ENUM ('WithClient', 'WithUs', 'WithVendor', 'ReturnedToClient');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sr_step_status AS ENUM ('Pending', 'InProgress', 'Done');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE attestation_inquiry_status AS ENUM ('Open', 'QuoteReceived', 'Accepted', 'Rejected', 'Converted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE attestation_document_class AS ENUM ('Personal', 'Business');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 8. Attestation Module: vendor_type column on vendors
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS vendor_type vendor_type NOT NULL DEFAULT 'Typing';

-- ──────────────────────────────────────────────────────────────────────────────
-- 9. Attestation Module tables
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attestation_services (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category attestation_category NOT NULL,
  document_class_applicability document_class NOT NULL DEFAULT 'Both',
  base_price_aed NUMERIC(10,2) NOT NULL DEFAULT 0,
  timeline_days INTEGER,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS attestation_service_variants (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id VARCHAR NOT NULL REFERENCES attestation_services(id) ON DELETE CASCADE,
  variant_label TEXT NOT NULL,
  price_aed NUMERIC(10,2) NOT NULL DEFAULT 0,
  timeline_days INTEGER,
  active BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_attest_svc_variants_service_id ON attestation_service_variants(service_id);

CREATE TABLE IF NOT EXISTS attestation_service_step_definitions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id VARCHAR NOT NULL REFERENCES attestation_services(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  step_type attestation_category NOT NULL,
  description TEXT
);
CREATE INDEX IF NOT EXISTS idx_attest_step_defs_service_id ON attestation_service_step_definitions(service_id);

CREATE TABLE IF NOT EXISTS attestation_service_requests (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  external_wo_number TEXT NOT NULL,
  inquiry_id VARCHAR,
  company_id VARCHAR NOT NULL REFERENCES companies(id),
  applicant_name TEXT,
  vendor_id VARCHAR NOT NULL REFERENCES vendors(id),
  attestation_service_id VARCHAR REFERENCES attestation_services(id),
  service_variant_id VARCHAR REFERENCES attestation_service_variants(id),
  document_type TEXT NOT NULL,
  document_name_description TEXT NOT NULL,
  document_class document_class NOT NULL,
  home_country TEXT,
  original_document_involved BOOLEAN NOT NULL DEFAULT false,
  status sr_status NOT NULL DEFAULT 'Draft',
  physical_custody_status physical_custody_status NOT NULL DEFAULT 'WithClient',
  current_custodian TEXT,
  current_responsible_staff_id VARCHAR REFERENCES users(id),
  service_fee_aed NUMERIC(10,2),
  fee_source TEXT,
  service_name TEXT,
  service_notes TEXT,
  internal_notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attest_sr_company_id ON attestation_service_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_attest_sr_vendor_id ON attestation_service_requests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_attest_sr_status ON attestation_service_requests(status);

CREATE TABLE IF NOT EXISTS attestation_sr_steps (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  sr_id VARCHAR NOT NULL REFERENCES attestation_service_requests(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  step_type attestation_category NOT NULL,
  status sr_step_status NOT NULL DEFAULT 'Pending',
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_attest_sr_steps_sr_id ON attestation_sr_steps(sr_id);

CREATE TABLE IF NOT EXISTS attestation_sr_activity_log (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  sr_id VARCHAR NOT NULL REFERENCES attestation_service_requests(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  detail TEXT,
  performed_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attest_sr_activity_sr_id ON attestation_sr_activity_log(sr_id);

CREATE TABLE IF NOT EXISTS attestation_inquiries (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id VARCHAR NOT NULL REFERENCES companies(id),
  applicant_name TEXT,
  vendor_id VARCHAR NOT NULL REFERENCES vendors(id),
  document_type TEXT NOT NULL,
  document_name_description TEXT NOT NULL,
  document_class attestation_document_class NOT NULL,
  home_country TEXT,
  description_of_need TEXT NOT NULL,
  external_wo_number TEXT,
  status attestation_inquiry_status NOT NULL DEFAULT 'Open',
  rejection_reason TEXT,
  converted_to_sr_id VARCHAR,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attestation_inquiries_company_id ON attestation_inquiries(company_id);
CREATE INDEX IF NOT EXISTS idx_attestation_inquiries_vendor_id ON attestation_inquiries(vendor_id);
CREATE INDEX IF NOT EXISTS idx_attestation_inquiries_status ON attestation_inquiries(status);

CREATE TABLE IF NOT EXISTS attestation_inquiry_quotes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id VARCHAR NOT NULL REFERENCES attestation_inquiries(id),
  vendor_id VARCHAR NOT NULL REFERENCES vendors(id),
  submitted_by_vendor_user_id VARCHAR REFERENCES users(id),
  quote_version INTEGER NOT NULL DEFAULT 1,
  amount_aed INTEGER NOT NULL,
  timeline_days INTEGER NOT NULL,
  notes TEXT,
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attestation_quotes_inquiry_id ON attestation_inquiry_quotes(inquiry_id);
