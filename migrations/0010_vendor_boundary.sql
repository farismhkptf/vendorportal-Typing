-- Migration 0010: Vendor Schema Boundary Implementation
-- ============================================================
-- PURPOSE: Enforce the approved vendor schema boundary:
--   - Move vendor-domain enum types out of public schema
--   - Move vendor-domain tables out of public schema
--   - After this migration: vendor.* owns all vendor data;
--     public.users remains the only public write exception
--
-- PREREQUISITES:
--   - Migration 0008 must have been applied (vendor schema and tables exist)
--   - Application code must be deployed with the updated schema.ts
--     (tables referencing vendor.* instead of public.*)
--
-- ROLLBACK: A matching rollback script should be created before running in production.
-- DO NOT RUN in production until code deployment is confirmed.
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1: Create vendor-schema enum types
-- These replace public-schema enums for vendor-domain status fields.
-- ============================================================

CREATE TYPE vendor.typing_job_status AS ENUM (
  'Draft', 'SubmittedToVendor', 'InProcess', 'Returned',
  'ReadyForScheduling', 'OnHold', 'Rejected', 'Aborted'
);

CREATE TYPE vendor.job_category AS ENUM ('Medical', 'EID');

CREATE TYPE vendor.file_direction AS ENUM ('Input', 'Output');

CREATE TYPE vendor.uploaded_by_type AS ENUM ('Internal', 'Vendor');

CREATE TYPE vendor.author_type AS ENUM ('Internal', 'Vendor');

CREATE TYPE vendor.change_notification_status AS ENUM ('pending', 'reviewed', 'dismissed');

CREATE TYPE vendor.deletion_request_status AS ENUM ('pending', 'approved', 'denied');


-- ============================================================
-- STEP 2: Migrate vendor.typing_jobs TEXT columns → vendor enum types
-- (Migration 0008 created these as TEXT; now enforcing proper types)
-- ============================================================

ALTER TABLE vendor.typing_jobs
  ALTER COLUMN status TYPE vendor.typing_job_status
    USING status::text::vendor.typing_job_status,
  ALTER COLUMN previous_status TYPE vendor.typing_job_status
    USING previous_status::text::vendor.typing_job_status;


-- ============================================================
-- STEP 3: Migrate vendor.typing_job_comments TEXT column → vendor enum type
-- ============================================================

ALTER TABLE vendor.typing_job_comments
  ALTER COLUMN author_type TYPE vendor.author_type
    USING author_type::text::vendor.author_type;


-- ============================================================
-- STEP 4: Migrate vendor.job_types TEXT column → vendor enum type
-- ============================================================

ALTER TABLE vendor.job_types
  ALTER COLUMN category TYPE vendor.job_category
    USING category::text::vendor.job_category;


-- ============================================================
-- STEP 5: Move public.files → vendor schema
-- This is the primary vendor write boundary fix:
-- vendor-portal.ts was the only code writing to public.files.
-- ============================================================

ALTER TABLE public.files SET SCHEMA vendor;

-- Migrate column types from public enums to vendor enums
ALTER TABLE vendor.files
  ALTER COLUMN direction TYPE vendor.file_direction
    USING direction::text::vendor.file_direction,
  ALTER COLUMN uploaded_by_type TYPE vendor.uploaded_by_type
    USING uploaded_by_type::text::vendor.uploaded_by_type;

-- Replace public index with vendor-namespaced index
DROP INDEX IF EXISTS public.idx_files_related_id;
CREATE INDEX IF NOT EXISTS idx_vendor_files_related_id ON vendor.files (related_id);


-- ============================================================
-- STEP 6: Move public.change_notifications → vendor schema
-- ============================================================

ALTER TABLE public.change_notifications SET SCHEMA vendor;

ALTER TABLE vendor.change_notifications
  ALTER COLUMN status TYPE vendor.change_notification_status
    USING status::text::vendor.change_notification_status;


-- ============================================================
-- STEP 7: Move public.staff_notifications → vendor schema
-- ============================================================

ALTER TABLE public.staff_notifications SET SCHEMA vendor;

-- Replace public index with vendor-namespaced index
DROP INDEX IF EXISTS public.idx_staff_notifications_user_id;
CREATE INDEX IF NOT EXISTS idx_vendor_staff_notifications_user_id ON vendor.staff_notifications (user_id);


-- ============================================================
-- STEP 8: Move public.deletion_requests → vendor schema
-- ============================================================

ALTER TABLE public.deletion_requests SET SCHEMA vendor;

ALTER TABLE vendor.deletion_requests
  ALTER COLUMN status TYPE vendor.deletion_request_status
    USING status::text::vendor.deletion_request_status;


-- ============================================================
-- STEP 9: Drop old public enum types
-- Only safe after all column references have been migrated above.
-- ============================================================

DROP TYPE IF EXISTS public.typing_job_status;
DROP TYPE IF EXISTS public.job_category;
DROP TYPE IF EXISTS public.file_direction;
DROP TYPE IF EXISTS public.uploaded_by_type;
DROP TYPE IF EXISTS public.author_type;
DROP TYPE IF EXISTS public.change_notification_status;
DROP TYPE IF EXISTS public.deletion_request_status;


COMMIT;

-- ============================================================
-- POST-MIGRATION VERIFICATION QUERIES (run manually to confirm)
-- ============================================================
-- SELECT schema_name, type_name FROM information_schema.user_defined_types
--   WHERE schema_name = 'vendor' ORDER BY type_name;
-- Should show: author_type, change_notification_status, deletion_request_status,
--              file_direction, job_category, typing_job_status, uploaded_by_type
--
-- SELECT table_schema, table_name FROM information_schema.tables
--   WHERE table_schema = 'vendor' AND table_name IN
--   ('files','change_notifications','staff_notifications','deletion_requests');
-- Should return 4 rows (all in vendor schema)
--
-- SELECT table_schema, table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name IN
--   ('files','change_notifications','staff_notifications','deletion_requests');
-- Should return 0 rows (all moved out of public)
