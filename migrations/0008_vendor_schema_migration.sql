-- =============================================================================
-- Migration 0008: Vendor Schema Migration
-- Creates vendor schema and scopes execution tables under it.
-- Adds vendor.vendor_users, vendor.cross_portal_events, and renames colliding
-- enums with vp_ prefix.
-- =============================================================================

-- Step 1: Create the vendor schema
CREATE SCHEMA IF NOT EXISTS vendor;

-- Step 2: Rename colliding enums with vp_ prefix
-- user_role → vpUserRole (only if exists and not already renamed)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    ALTER TYPE user_role RENAME TO vp_user_role;
  END IF;
END $$;

-- wo_status: vendor portal no longer owns work orders, but keep enum for public schema use
-- If vendor portal had a local copy, note: it references public.work_orders in the future.
-- Enum remains as-is; the table will be dropped later via 0009 safety-gated migration.

-- Step 3: Create vendor.vendor_users table for portal-local auth
-- /* portal-local auth; future shared identity / SSO may replace this table */
CREATE TABLE IF NOT EXISTS vendor.vendor_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator', -- operator | admin
  active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

COMMENT ON TABLE vendor.vendor_users IS 'portal-local auth; future shared identity / SSO may replace this table';

-- Step 4: Migrate vendor-role users from public.users to vendor.vendor_users
-- (Only if users table exists and has vendor rows, and vendor_id is populated)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    INSERT INTO vendor.vendor_users (id, vendor_id, name, email, password_hash, role, active, created_at)
    SELECT
      gen_random_uuid(),
      COALESCE(vendor_id::UUID, gen_random_uuid()),
      name,
      email,
      password_hash,
      'operator',
      active,
      created_at
    FROM public.users
    WHERE role::TEXT = 'Vendor' AND vendor_id IS NOT NULL
    ON CONFLICT (email) DO NOTHING;
  END IF;
END $$;

-- Step 5: Create vendor.cross_portal_events table (outbound event queue)
-- Vendor Portal inserts with status='pending'; Client Portal consumer sets status='sent' and processed_at.
CREATE TABLE IF NOT EXISTS vendor.cross_portal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,   -- caller MUST provide stable composite key, e.g. 'typing_job.<uuid>.completed'
  source_app TEXT NOT NULL DEFAULT 'vendor_portal', -- always 'vendor_portal' for this event bus
  event_type TEXT NOT NULL,               -- e.g. 'typing_job.completed', 'sr.status_changed'
  aggregate_type TEXT NOT NULL,           -- 'typing_job' | 'attestation_sr' | 'appointment_cycle'
  aggregate_id UUID NOT NULL,             -- root entity UUID
  payload JSONB NOT NULL,
  work_order_id UUID,                     -- FK → public.work_orders ON DELETE RESTRICT ON UPDATE CASCADE
  company_id UUID,                        -- FK → public.companies ON DELETE RESTRICT ON UPDATE CASCADE
  -- Lifecycle: Vendor Portal inserts status='pending'; Client Portal consumer sets sent/failed + processed_at
  status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed
  processed_at TIMESTAMP,                 -- set ONLY by Client Portal consumer
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  created_by UUID                         -- vendor user who triggered the event
);

CREATE INDEX IF NOT EXISTS idx_cross_portal_events_status ON vendor.cross_portal_events (status);
CREATE INDEX IF NOT EXISTS idx_cross_portal_events_work_order_id ON vendor.cross_portal_events (work_order_id);
CREATE INDEX IF NOT EXISTS idx_cross_portal_events_created_at ON vendor.cross_portal_events (created_at);
CREATE INDEX IF NOT EXISTS idx_cross_portal_events_event_type ON vendor.cross_portal_events (event_type);
CREATE INDEX IF NOT EXISTS idx_cross_portal_events_aggregate ON vendor.cross_portal_events (aggregate_type, aggregate_id);

-- Step 6: Move medical_cases to vendor schema
CREATE TABLE IF NOT EXISTS vendor.medical_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL,
  is_open BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (work_order_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_medical_cases_wo_id ON vendor.medical_cases (work_order_id);

-- Migrate existing data from public.medical_cases if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'medical_cases') THEN
    INSERT INTO vendor.medical_cases (id, work_order_id, is_open, created_at)
    SELECT id::UUID, wo_id::UUID, is_open, created_at
    FROM public.medical_cases
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Step 7: Move appointment_cycles to vendor schema
CREATE TABLE IF NOT EXISTS vendor.appointment_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL,
  cycle_number INTEGER NOT NULL DEFAULT 1,
  cycle_type TEXT NOT NULL DEFAULT 'Initial',
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  appointment_time TIMESTAMP NOT NULL,
  center_id UUID,
  assigned_pro_id UUID,
  outcome TEXT,
  awaiting_meeting_at TIMESTAMP,
  no_show_at TIMESTAMP,
  completed_at TIMESTAMP,
  result_delayed_at TIMESTAMP,
  result_issued_at TIMESTAMP,
  crm_hold_active BOOLEAN NOT NULL DEFAULT false,
  crm_hold_set_by UUID,
  crm_hold_set_at TIMESTAMP,
  confirmed_at TIMESTAMP,
  confirmed_by UUID,
  confirm_method TEXT,
  override_reason TEXT,
  override_by UUID,
  override_at TIMESTAMP,
  created_by UUID,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_appt_cycles_case_id ON vendor.appointment_cycles (case_id);
CREATE INDEX IF NOT EXISTS idx_vendor_appt_cycles_status ON vendor.appointment_cycles (status);

-- Step 8: Move medical_appointment_events to vendor schema
CREATE TABLE IF NOT EXISTS vendor.medical_appointment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  actor_id UUID,
  actor_role TEXT,
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_medical_events_cycle_id ON vendor.medical_appointment_events (cycle_id);

-- Step 9: Move biometrics_cases to vendor schema
CREATE TABLE IF NOT EXISTS vendor.biometrics_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL,
  is_open BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (work_order_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_biometrics_cases_wo_id ON vendor.biometrics_cases (work_order_id);

-- Step 10: Move biometrics_appointment_cycles to vendor schema
CREATE TABLE IF NOT EXISTS vendor.biometrics_appointment_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL,
  cycle_number INTEGER NOT NULL DEFAULT 1,
  cycle_type TEXT NOT NULL DEFAULT 'Initial',
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  appointment_time TIMESTAMP NOT NULL,
  center_id UUID,
  assigned_pro_id UUID,
  outcome TEXT,
  awaiting_meeting_at TIMESTAMP,
  no_show_at TIMESTAMP,
  completed_at TIMESTAMP,
  crm_hold_active BOOLEAN NOT NULL DEFAULT false,
  crm_hold_set_by UUID,
  crm_hold_set_at TIMESTAMP,
  confirmed_at TIMESTAMP,
  confirmed_by UUID,
  confirm_method TEXT,
  proof_image_url TEXT,
  proof_uploaded_at TIMESTAMP,
  override_reason TEXT,
  override_by UUID,
  override_at TIMESTAMP,
  created_by UUID,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_biometrics_cycles_case_id ON vendor.biometrics_appointment_cycles (case_id);

-- Step 11: Move biometrics_appointment_events to vendor schema
CREATE TABLE IF NOT EXISTS vendor.biometrics_appointment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  actor_id UUID,
  actor_role TEXT,
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_biometrics_events_cycle_id ON vendor.biometrics_appointment_events (cycle_id);

-- Step 12: Create vendor.centers table (vendor-owned execution resource)
CREATE TABLE IF NOT EXISTS vendor.centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  authority TEXT,
  tier TEXT DEFAULT 'Normal',
  address TEXT,
  google_maps_url TEXT,
  area TEXT,
  timing_text TEXT,
  timings JSONB,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true
);

-- Migrate existing centers data if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'centers') THEN
    INSERT INTO vendor.centers (id, name, type, authority, tier, address, google_maps_url, area, timing_text, timings, notes, active)
    SELECT id::UUID, name, type::TEXT, authority::TEXT, tier::TEXT, address, google_maps_url, area, timing_text, timings::JSONB, notes, active
    FROM public.centers
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Step 13: Create vendor.vendors table
-- /* future: may be promoted to shared master data */
CREATE TABLE IF NOT EXISTS vendor.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  logo_url TEXT,
  vendor_type TEXT NOT NULL DEFAULT 'Typing'
);

COMMENT ON TABLE vendor.vendors IS 'future: may be promoted to shared master data';

-- Migrate existing vendors data if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vendors') THEN
    INSERT INTO vendor.vendors (id, name, contact_person, phone, email, active, logo_url, vendor_type)
    SELECT id::UUID, name, contact_person, phone, email, active, logo_url, vendor_type::TEXT
    FROM public.vendors
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Step 14: Create vendor.vendor_wallet_ledger
CREATE TABLE IF NOT EXISTS vendor.vendor_wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL,
  entry_type TEXT NOT NULL,
  typing_job_id UUID,
  amount INTEGER NOT NULL,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_wallet_ledger_vendor_id ON vendor.vendor_wallet_ledger (vendor_id);

-- Step 15: Create vendor.vendor_statements
CREATE TABLE IF NOT EXISTS vendor.vendor_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  generated_at TIMESTAMP NOT NULL DEFAULT now(),
  total_debit INTEGER NOT NULL DEFAULT 0,
  total_credit INTEGER NOT NULL DEFAULT 0,
  balance_delta INTEGER NOT NULL DEFAULT 0
);

-- Step 16: Create vendor.vendor_invoices
CREATE TABLE IF NOT EXISTS vendor.vendor_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  invoice_file_workdrive_id TEXT,
  invoice_link TEXT,
  amount INTEGER NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Step 17: Create vendor.audit_log under vendor schema
CREATE TABLE IF NOT EXISTS vendor.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  user_id UUID,
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_audit_log_entity_id ON vendor.audit_log (entity_id);
CREATE INDEX IF NOT EXISTS idx_vendor_audit_log_user_id ON vendor.audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_audit_log_created_at ON vendor.audit_log (created_at);

-- Step 18: Create vendor.login_audit_log
CREATE TABLE IF NOT EXISTS vendor.login_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  email TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  portal TEXT NOT NULL DEFAULT 'vendor',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Step 19: Create vendor.vendor_notifications (persistent vendor inbox with read_at)
CREATE TABLE IF NOT EXISTS vendor.vendor_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_user_id UUID NOT NULL,
  vendor_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_job_id UUID,
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

COMMENT ON TABLE vendor.vendor_notifications IS 'Persistent vendor inbox. Records are never deleted on read — use read_at for acknowledgment tracking. Internal staff alerts go to vendor.audit_log only.';

CREATE INDEX IF NOT EXISTS idx_vendor_notifications_vendor_user_id ON vendor.vendor_notifications (vendor_user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_notifications_vendor_id ON vendor.vendor_notifications (vendor_id);

-- Step 20: Create vendor.app_settings (all keys namespaced with vp_ prefix)
CREATE TABLE IF NOT EXISTS vendor.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vp_from_email TEXT NOT NULL DEFAULT 'notifications@procompany.ae',
  vp_from_name TEXT NOT NULL DEFAULT 'The P.R.O. Company',
  vp_reply_to_email TEXT NOT NULL DEFAULT 'operations@procompany.ae',
  vp_always_cc JSONB DEFAULT '[]',
  vp_test_email_redirect TEXT,
  vp_low_balance_threshold INTEGER NOT NULL DEFAULT 1000,
  vp_master_password TEXT,
  vp_default_vendor_id UUID,
  vp_maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  vp_maintenance_message TEXT,
  vp_whatsapp_number TEXT DEFAULT '+971509161815',
  vp_privacy_policy_html TEXT,
  vp_terms_of_service_html TEXT,
  vp_vendor_delay_threshold_hours INTEGER NOT NULL DEFAULT 48,
  vp_follow_up_center TEXT,
  vp_logo_url TEXT
);

-- Migrate existing app_settings data from public schema to vendor schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_settings') THEN
    INSERT INTO vendor.app_settings (
      vp_from_email, vp_from_name, vp_reply_to_email, vp_always_cc, vp_test_email_redirect,
      vp_low_balance_threshold, vp_master_password, vp_default_vendor_id, vp_maintenance_mode,
      vp_maintenance_message, vp_whatsapp_number, vp_vendor_delay_threshold_hours, vp_follow_up_center, vp_logo_url
    )
    SELECT
      COALESCE(from_email, 'notifications@procompany.ae'),
      COALESCE(from_name, 'The P.R.O. Company'),
      COALESCE(reply_to_email, 'operations@procompany.ae'),
      COALESCE(always_cc::JSONB, '[]'::JSONB),
      test_email_redirect,
      COALESCE(low_balance_threshold, 1000),
      master_password,
      NULL, -- default_vendor_id: skip, will be set via admin UI
      COALESCE(maintenance_mode, false),
      maintenance_message,
      COALESCE(whatsapp_number, '+971509161815'),
      COALESCE(vendor_delay_threshold_hours, 48),
      follow_up_center,
      logo_url
    FROM public.app_settings
    LIMIT 1
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Step 21: Create vendor.attestation_service_requests under vendor schema
CREATE TABLE IF NOT EXISTS vendor.attestation_service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sr_number VARCHAR(20) UNIQUE,
  external_wo_number TEXT,
  inquiry_id UUID,
  company_id UUID NOT NULL,
  person_id UUID,
  applicant_name TEXT,
  document_name TEXT,
  vendor_id UUID,
  assigned_pro_id UUID,
  attestation_service_id UUID,
  service_variant_id UUID,
  document_type TEXT,
  document_name_description TEXT,
  document_class TEXT,
  home_country TEXT,
  original_document_involved BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'Draft',
  physical_custody_status TEXT NOT NULL DEFAULT 'WithClient',
  current_custodian TEXT,
  current_responsible_staff_id UUID,
  service_fee_aed NUMERIC(10,2),
  fee_source TEXT,
  service_name TEXT,
  service_notes TEXT,
  internal_notes TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_attest_sr_company_id ON vendor.attestation_service_requests (company_id);
CREATE INDEX IF NOT EXISTS idx_vendor_attest_sr_vendor_id ON vendor.attestation_service_requests (vendor_id);

-- Step 22: Create vendor.attestation_sr_steps
CREATE TABLE IF NOT EXISTS vendor.attestation_sr_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sr_id UUID NOT NULL REFERENCES vendor.attestation_service_requests(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  step_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_vendor_attest_sr_steps_sr_id ON vendor.attestation_sr_steps (sr_id);

-- Step 23: Create vendor.attestation_sr_activity_log
CREATE TABLE IF NOT EXISTS vendor.attestation_sr_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sr_id UUID NOT NULL REFERENCES vendor.attestation_service_requests(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  detail TEXT,
  performed_by UUID,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_attest_sr_activity_sr_id ON vendor.attestation_sr_activity_log (sr_id);

-- Step 24: Create vendor.attestation_inquiries
CREATE TABLE IF NOT EXISTS vendor.attestation_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  person_id UUID,
  applicant_name TEXT,
  vendor_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  document_name_description TEXT NOT NULL,
  document_class TEXT NOT NULL,
  home_country TEXT,
  description_of_need TEXT NOT NULL,
  external_wo_number TEXT,
  status TEXT NOT NULL DEFAULT 'Open',
  rejection_reason TEXT,
  converted_to_sr_id UUID,
  created_by UUID,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_attest_inquiries_company_id ON vendor.attestation_inquiries (company_id);
CREATE INDEX IF NOT EXISTS idx_vendor_attest_inquiries_vendor_id ON vendor.attestation_inquiries (vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_attest_inquiries_status ON vendor.attestation_inquiries (status);

-- Step 25: Create vendor.attestation_inquiry_quotes
CREATE TABLE IF NOT EXISTS vendor.attestation_inquiry_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES vendor.attestation_inquiries(id),
  vendor_id UUID NOT NULL,
  submitted_by_vendor_user_id UUID,
  quote_version INTEGER NOT NULL DEFAULT 1,
  amount_aed INTEGER NOT NULL,
  timeline_days INTEGER NOT NULL,
  notes TEXT,
  submitted_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_attest_quotes_inquiry_id ON vendor.attestation_inquiry_quotes (inquiry_id);

-- Step 26: Create vendor.document_custody_records under vendor schema
CREATE TABLE IF NOT EXISTS vendor.document_custody_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number VARCHAR(20) NOT NULL UNIQUE,
  company_id UUID NOT NULL,
  work_order_id UUID, -- FK → public.work_orders ON DELETE RESTRICT ON UPDATE CASCADE
  sr_id UUID,         -- FK → vendor.attestation_sr
  doc_category TEXT NOT NULL,
  doc_subtype TEXT NOT NULL,
  doc_custom_name TEXT,
  custody_stage TEXT NOT NULL DEFAULT 'WithClient',
  notify_email TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_doc_custody_records_company_id ON vendor.document_custody_records (company_id);
CREATE INDEX IF NOT EXISTS idx_vendor_doc_custody_records_work_order_id ON vendor.document_custody_records (work_order_id);
CREATE INDEX IF NOT EXISTS idx_vendor_doc_custody_records_sr_id ON vendor.document_custody_records (sr_id);

-- Step 27: Create vendor.document_custody_handoffs
CREATE TABLE IF NOT EXISTS vendor.document_custody_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL,
  from_stage TEXT NOT NULL,
  to_stage TEXT NOT NULL,
  counterparty_name TEXT NOT NULL,
  counterparty_contact TEXT NOT NULL,
  counterparty_id_photo_url TEXT,
  notes TEXT,
  performed_by UUID NOT NULL,
  performed_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_doc_custody_handoffs_record_id ON vendor.document_custody_handoffs (record_id);

-- Step 28: Create vendor.typing_jobs
CREATE TABLE IF NOT EXISTS vendor.typing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_code TEXT,
  work_order_id UUID NOT NULL,
  vendor_id UUID,
  job_type_id UUID NOT NULL,
  assigned_to_user_id UUID,
  status TEXT NOT NULL DEFAULT 'Draft',
  cost_snapshot INTEGER,
  sent_at TIMESTAMP,
  returned_at TIMESTAMP,
  sent_to_client_at TIMESTAMP,
  vendor_mistake_at TIMESTAMP,
  vendor_mistake_reason TEXT,
  created_by UUID,
  previous_status TEXT,
  rejected_reason TEXT,
  urgent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_typing_jobs_work_order_id ON vendor.typing_jobs (work_order_id);
CREATE INDEX IF NOT EXISTS idx_vendor_typing_jobs_vendor_id ON vendor.typing_jobs (vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_typing_jobs_status ON vendor.typing_jobs (status);

-- Step 29: Create vendor.typing_job_results
CREATE TABLE IF NOT EXISTS vendor.typing_job_results (
  typing_job_id UUID PRIMARY KEY,
  application_ref_no TEXT,
  center_name TEXT,
  center_area TEXT,
  center_notes TEXT,
  biometrics_required BOOLEAN DEFAULT false,
  biometrics_datetime TIMESTAMP,
  biometrics_center TEXT,
  vendor_notes TEXT
);

-- Step 30: Create vendor.typing_job_comments
CREATE TABLE IF NOT EXISTS vendor.typing_job_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  typing_job_id UUID NOT NULL,
  author_type TEXT NOT NULL,
  author_user_id UUID,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_typing_job_comments_typing_job_id ON vendor.typing_job_comments (typing_job_id);

-- Step 31: Create vendor.vendor_approvals
CREATE TABLE IF NOT EXISTS vendor.vendor_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  typing_job_id UUID NOT NULL,
  vendor_id UUID NOT NULL,
  calculated_amount INTEGER NOT NULL DEFAULT 0,
  adjusted_amount INTEGER,
  status TEXT NOT NULL DEFAULT 'Pending',
  rejected_reason TEXT,
  approved_by UUID,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vendor_approvals_typing_job_id ON vendor.vendor_approvals (typing_job_id);
CREATE INDEX IF NOT EXISTS idx_vendor_approvals_vendor_id ON vendor.vendor_approvals (vendor_id);

-- Step 32: Create vendor.job_types (vendor portal typing service catalog)
CREATE TABLE IF NOT EXISTS vendor.job_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Medical',
  description TEXT,
  cost INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true
);

-- Migrate existing job_types from public schema if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'job_types') THEN
    INSERT INTO vendor.job_types (id, name, description, cost, active)
    SELECT id::UUID, name, description, cost, active
    FROM public.job_types
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Step 33: Create vendor.attestation_categories
CREATE TABLE IF NOT EXISTS vendor.attestation_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true
);

-- Migrate existing attestation_categories from public schema if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attestation_categories') THEN
    INSERT INTO vendor.attestation_categories (id, name, sort_order, active)
    SELECT id::UUID, name, sort_order, active
    FROM public.attestation_categories
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Step 34: Create vendor.attestation_services
CREATE TABLE IF NOT EXISTS vendor.attestation_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  document_class_applicability TEXT NOT NULL DEFAULT 'Both',
  base_price_aed NUMERIC(10,2) NOT NULL DEFAULT 0,
  timeline_days INTEGER,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true
);

-- Migrate existing attestation_services from public schema if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attestation_services') THEN
    INSERT INTO vendor.attestation_services (id, name, category, document_class_applicability, base_price_aed, timeline_days, description, active)
    SELECT id::UUID, name, category::TEXT, document_class_applicability::TEXT, base_price_aed, timeline_days, description, active
    FROM public.attestation_services
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Step 35: Create vendor.attestation_service_variants
CREATE TABLE IF NOT EXISTS vendor.attestation_service_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL,
  variant_label TEXT NOT NULL,
  price_aed NUMERIC(10,2) NOT NULL DEFAULT 0,
  timeline_days INTEGER,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_vendor_attest_svc_variants_service_id ON vendor.attestation_service_variants (service_id);

-- Migrate existing attestation_service_variants from public schema if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attestation_service_variants') THEN
    INSERT INTO vendor.attestation_service_variants (id, service_id, variant_label, price_aed, timeline_days, active)
    SELECT id::UUID, service_id::UUID, variant_label, price_aed, timeline_days, active
    FROM public.attestation_service_variants
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Step 36: Create vendor.attestation_service_step_definitions
CREATE TABLE IF NOT EXISTS vendor.attestation_service_step_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL,
  step_order INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  step_type TEXT NOT NULL,
  description TEXT
);

CREATE INDEX IF NOT EXISTS idx_vendor_attest_step_defs_service_id ON vendor.attestation_service_step_definitions (service_id);

-- Migrate existing attestation_service_step_definitions from public schema if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attestation_service_step_definitions') THEN
    INSERT INTO vendor.attestation_service_step_definitions (id, service_id, step_order, step_name, step_type, description)
    SELECT id::UUID, service_id::UUID, step_order, step_name, step_type::TEXT, description
    FROM public.attestation_service_step_definitions
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- Cross-schema FK constraints: vendor tables → public.* tables
-- All enforced with ON DELETE RESTRICT ON UPDATE CASCADE.
-- These are intentionally NOT declared in Drizzle ORM (which
-- doesn't support cross-schema FKs) but are enforced in SQL.
-- ============================================================

DO $$
BEGIN
  -- vendor.typing_jobs.work_order_id → public.work_orders
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'vendor' AND constraint_name = 'fk_typing_jobs_work_order_id'
  ) THEN
    ALTER TABLE vendor.typing_jobs
      ADD CONSTRAINT fk_typing_jobs_work_order_id
      FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- vendor.typing_jobs.vendor_id → vendor.vendors
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'vendor' AND constraint_name = 'fk_typing_jobs_vendor_id'
  ) THEN
    ALTER TABLE vendor.typing_jobs
      ADD CONSTRAINT fk_typing_jobs_vendor_id
      FOREIGN KEY (vendor_id) REFERENCES vendor.vendors(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- vendor.vendor_approvals.typing_job_id → vendor.typing_jobs
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'vendor' AND constraint_name = 'fk_vendor_approvals_typing_job_id'
  ) THEN
    ALTER TABLE vendor.vendor_approvals
      ADD CONSTRAINT fk_vendor_approvals_typing_job_id
      FOREIGN KEY (typing_job_id) REFERENCES vendor.typing_jobs(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- vendor.vendor_approvals.vendor_id → vendor.vendors
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'vendor' AND constraint_name = 'fk_vendor_approvals_vendor_id'
  ) THEN
    ALTER TABLE vendor.vendor_approvals
      ADD CONSTRAINT fk_vendor_approvals_vendor_id
      FOREIGN KEY (vendor_id) REFERENCES vendor.vendors(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- vendor.document_custody_records.company_id → public.companies
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'vendor' AND constraint_name = 'fk_doc_custody_records_company_id'
  ) THEN
    ALTER TABLE vendor.document_custody_records
      ADD CONSTRAINT fk_doc_custody_records_company_id
      FOREIGN KEY (company_id) REFERENCES public.companies(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- vendor.document_custody_records.work_order_id → public.work_orders
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'vendor' AND constraint_name = 'fk_doc_custody_records_work_order_id'
  ) THEN
    ALTER TABLE vendor.document_custody_records
      ADD CONSTRAINT fk_doc_custody_records_work_order_id
      FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- vendor.document_custody_handoffs.record_id → vendor.document_custody_records
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'vendor' AND constraint_name = 'fk_doc_custody_handoffs_record_id'
  ) THEN
    ALTER TABLE vendor.document_custody_handoffs
      ADD CONSTRAINT fk_doc_custody_handoffs_record_id
      FOREIGN KEY (record_id) REFERENCES vendor.document_custody_records(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- vendor.cross_portal_events.work_order_id → public.work_orders
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'vendor' AND constraint_name = 'fk_cross_portal_events_work_order_id'
  ) THEN
    ALTER TABLE vendor.cross_portal_events
      ADD CONSTRAINT fk_cross_portal_events_work_order_id
      FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- vendor.cross_portal_events.company_id → public.companies
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'vendor' AND constraint_name = 'fk_cross_portal_events_company_id'
  ) THEN
    ALTER TABLE vendor.cross_portal_events
      ADD CONSTRAINT fk_cross_portal_events_company_id
      FOREIGN KEY (company_id) REFERENCES public.companies(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- vendor.vendor_wallet_ledger.vendor_id → vendor.vendors
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'vendor' AND constraint_name = 'fk_vendor_wallet_ledger_vendor_id'
  ) THEN
    ALTER TABLE vendor.vendor_wallet_ledger
      ADD CONSTRAINT fk_vendor_wallet_ledger_vendor_id
      FOREIGN KEY (vendor_id) REFERENCES vendor.vendors(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- vendor.vendor_notifications.vendor_id → vendor.vendors
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'vendor' AND constraint_name = 'fk_vendor_notifications_vendor_id'
  ) THEN
    ALTER TABLE vendor.vendor_notifications
      ADD CONSTRAINT fk_vendor_notifications_vendor_id
      FOREIGN KEY (vendor_id) REFERENCES vendor.vendors(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- vendor.medical_cases.work_order_id → public.work_orders
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'vendor' AND constraint_name = 'fk_medical_cases_work_order_id'
  ) THEN
    ALTER TABLE vendor.medical_cases
      ADD CONSTRAINT fk_medical_cases_work_order_id
      FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- vendor.biometrics_cases.work_order_id → public.work_orders
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'vendor' AND constraint_name = 'fk_biometrics_cases_work_order_id'
  ) THEN
    ALTER TABLE vendor.biometrics_cases
      ADD CONSTRAINT fk_biometrics_cases_work_order_id
      FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- vendor.attestation_service_requests.company_id → public.companies
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'vendor' AND constraint_name = 'fk_attest_sr_company_id'
  ) THEN
    ALTER TABLE vendor.attestation_service_requests
      ADD CONSTRAINT fk_attest_sr_company_id
      FOREIGN KEY (company_id) REFERENCES public.companies(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- vendor.attestation_service_requests.vendor_id → vendor.vendors
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'vendor' AND constraint_name = 'fk_attest_sr_vendor_id'
  ) THEN
    ALTER TABLE vendor.attestation_service_requests
      ADD CONSTRAINT fk_attest_sr_vendor_id
      FOREIGN KEY (vendor_id) REFERENCES vendor.vendors(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- vendor.attestation_inquiries.company_id → public.companies
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'vendor' AND constraint_name = 'fk_attest_inquiries_company_id'
  ) THEN
    ALTER TABLE vendor.attestation_inquiries
      ADD CONSTRAINT fk_attest_inquiries_company_id
      FOREIGN KEY (company_id) REFERENCES public.companies(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- vendor.attestation_inquiries.vendor_id → vendor.vendors
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'vendor' AND constraint_name = 'fk_attest_inquiries_vendor_id'
  ) THEN
    ALTER TABLE vendor.attestation_inquiries
      ADD CONSTRAINT fk_attest_inquiries_vendor_id
      FOREIGN KEY (vendor_id) REFERENCES vendor.vendors(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- vendor.attestation_inquiry_quotes.inquiry_id → vendor.attestation_inquiries
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'vendor' AND constraint_name = 'fk_attest_quotes_inquiry_id'
  ) THEN
    ALTER TABLE vendor.attestation_inquiry_quotes
      ADD CONSTRAINT fk_attest_quotes_inquiry_id
      FOREIGN KEY (inquiry_id) REFERENCES vendor.attestation_inquiries(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- vendor.attestation_inquiry_quotes.vendor_id → vendor.vendors
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'vendor' AND constraint_name = 'fk_attest_quotes_vendor_id'
  ) THEN
    ALTER TABLE vendor.attestation_inquiry_quotes
      ADD CONSTRAINT fk_attest_quotes_vendor_id
      FOREIGN KEY (vendor_id) REFERENCES vendor.vendors(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- vendor.vendor_users.vendor_id → vendor.vendors
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'vendor' AND constraint_name = 'fk_vendor_users_vendor_id'
  ) THEN
    ALTER TABLE vendor.vendor_users
      ADD CONSTRAINT fk_vendor_users_vendor_id
      FOREIGN KEY (vendor_id) REFERENCES vendor.vendors(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
