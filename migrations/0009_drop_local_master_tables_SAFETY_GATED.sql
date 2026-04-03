-- =============================================================================
-- Migration 0009: Drop Local Master Tables (SAFETY GATED)
-- 
-- ⚠️  CRITICAL: DO NOT RUN THIS MIGRATION UNTIL ALL SAFETY CHECKS BELOW PASS ⚠️
-- 
-- This migration drops Vendor Portal's local copies of master data tables:
--   - public.companies (owned by Client Portal)
--   - public.work_orders (owned by Client Portal)
--   - public.staff (owned by Client Portal)
--   - public.service_types (owned by Client Portal)
--
-- PRE-EXECUTION SAFETY CHECKLIST (must all pass before executing):
-- [ ] 1. Confirm public.companies, public.people, public.work_orders exist in
--        the shared Neon DB and are populated with migrated records.
-- [ ] 2. Run row count verification:
--        SELECT COUNT(*) FROM public.companies;
--        SELECT COUNT(*) FROM public.work_orders;
--        SELECT COUNT(*) FROM public.people;
--        Compare against previous local table counts.
-- [ ] 3. Confirm all cross-schema FK constraints resolve without errors.
--        Test join: SELECT vc.id FROM vendor.medical_cases vc
--                   JOIN public.work_orders wo ON vc.work_order_id = wo.id LIMIT 1;
-- [ ] 4. Confirm a full database backup or PITR checkpoint has been taken.
-- [ ] 5. Confirm the Vendor Portal application has been redeployed with the new
--        schema that reads from vendor.* tables instead of public.* master tables.
-- [ ] 6. Confirm no active Vendor Portal routes write to companies, work_orders,
--        staff, or service_types.
--
-- To execute: uncomment the DROP TABLE statements below after all checks pass.
-- =============================================================================

-- SAFETY GATE: This block will error if public.work_orders doesn't exist,
-- preventing accidental execution before the shared Neon DB is ready.
DO $$
DECLARE
  companies_count INTEGER;
  work_orders_count INTEGER;
BEGIN
  -- Verify shared tables exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies') THEN
    RAISE EXCEPTION 'SAFETY GATE FAILED: public.companies does not exist. Ensure Client Portal has migrated shared master data before running this migration.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'work_orders') THEN
    RAISE EXCEPTION 'SAFETY GATE FAILED: public.work_orders does not exist. Ensure Client Portal has migrated shared master data before running this migration.';
  END IF;

  -- Check that shared tables are populated
  SELECT COUNT(*) INTO companies_count FROM public.companies;
  SELECT COUNT(*) INTO work_orders_count FROM public.work_orders;

  IF companies_count = 0 THEN
    RAISE EXCEPTION 'SAFETY GATE FAILED: public.companies is empty. Populate shared master data before dropping local copies.';
  END IF;

  IF work_orders_count = 0 THEN
    RAISE EXCEPTION 'SAFETY GATE FAILED: public.work_orders is empty. Populate shared master data before dropping local copies.';
  END IF;

  RAISE NOTICE 'Safety gate passed: public.companies has % rows, public.work_orders has % rows', companies_count, work_orders_count;
END $$;

-- =============================================================================
-- UNCOMMENT THE FOLLOWING STATEMENTS ONLY AFTER ALL SAFETY CHECKS PASS
-- =============================================================================

-- Drop local service_types table (now owned by Client Portal)
-- DROP TABLE IF EXISTS public.service_types CASCADE;

-- Drop local staff table (now owned by Client Portal)
-- DROP TABLE IF EXISTS public.staff CASCADE;

-- Drop local work_orders table (now owned by Client Portal)
-- DROP TABLE IF EXISTS public.work_orders CASCADE;

-- Drop local companies table (now owned by Client Portal)
-- DROP TABLE IF EXISTS public.companies CASCADE;

-- Drop company_emails if it belongs to companies (owned by Client Portal)
-- DROP TABLE IF EXISTS public.company_emails CASCADE;

-- Drop wo_documents if tied to work_orders (owned by Client Portal)
-- DROP TABLE IF EXISTS public.wo_documents CASCADE;

-- Drop document_requirements if tied to service_types (owned by Client Portal)
-- DROP TABLE IF EXISTS public.document_requirements CASCADE;

-- Drop appointments table if it's a Client Portal concern
-- DROP TABLE IF EXISTS public.appointments CASCADE;

-- Drop reschedule_requests if tied to appointments
-- DROP TABLE IF EXISTS public.reschedule_requests CASCADE;

-- Drop wo_notes if tied to work_orders
-- DROP TABLE IF EXISTS public.wo_notes CASCADE;

-- Remove Vendor role from public.users after migration to vendor.vendor_users
-- DELETE FROM public.users WHERE role = 'Vendor';

COMMIT;
