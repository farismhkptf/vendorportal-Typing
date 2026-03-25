-- Attestation Module Migration
-- Adds vendor_type column to vendors and all attestation-related tables/enums

-- Create new enum types if they don't exist
DO $$ BEGIN
  CREATE TYPE "vendor_type" AS ENUM ('Typing', 'Attestation');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "attestation_category" AS ENUM ('MofaUAE', 'MofaHomeCountry', 'Embassy', 'Lawyer', 'Other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "document_class" AS ENUM ('Personal', 'Business', 'Both');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "sr_status" AS ENUM ('Draft', 'SentToVendor', 'AcceptedByVendor', 'InProgress', 'Completed', 'Cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "physical_custody_status" AS ENUM ('WithClient', 'WithUs', 'WithVendor', 'ReturnedToClient');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "sr_step_status" AS ENUM ('Pending', 'InProgress', 'Done');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add vendor_type column to vendors table (default Typing for all existing vendors)
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "vendor_type" "vendor_type" NOT NULL DEFAULT 'Typing';

-- Create attestation_services table
CREATE TABLE IF NOT EXISTS "attestation_services" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "category" "attestation_category" NOT NULL,
  "document_class_applicability" "document_class" NOT NULL DEFAULT 'Both',
  "base_price_aed" numeric(10, 2) NOT NULL DEFAULT '0',
  "timeline_days" integer,
  "description" text,
  "active" boolean NOT NULL DEFAULT true
);

-- Create attestation_service_variants table
CREATE TABLE IF NOT EXISTS "attestation_service_variants" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "service_id" varchar NOT NULL REFERENCES "attestation_services"("id") ON DELETE CASCADE,
  "variant_label" text NOT NULL,
  "price_aed" numeric(10, 2) NOT NULL DEFAULT '0',
  "timeline_days" integer,
  "active" boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS "idx_attest_svc_variants_service_id" ON "attestation_service_variants" ("service_id");

-- Create attestation_service_step_definitions table
CREATE TABLE IF NOT EXISTS "attestation_service_step_definitions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "service_id" varchar NOT NULL REFERENCES "attestation_services"("id") ON DELETE CASCADE,
  "step_order" integer NOT NULL,
  "step_name" text NOT NULL,
  "step_type" "attestation_category" NOT NULL,
  "description" text
);

CREATE INDEX IF NOT EXISTS "idx_attest_step_defs_service_id" ON "attestation_service_step_definitions" ("service_id");

-- Create attestation_service_requests table
CREATE TABLE IF NOT EXISTS "attestation_service_requests" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "external_wo_number" text NOT NULL,
  "inquiry_id" varchar,
  "company_id" varchar NOT NULL REFERENCES "companies"("id"),
  "applicant_name" text,
  "vendor_id" varchar NOT NULL REFERENCES "vendors"("id"),
  "attestation_service_id" varchar NOT NULL REFERENCES "attestation_services"("id"),
  "service_variant_id" varchar REFERENCES "attestation_service_variants"("id"),
  "document_type" text NOT NULL,
  "document_name_description" text NOT NULL,
  "document_class" "document_class" NOT NULL,
  "home_country" text,
  "original_document_involved" boolean NOT NULL DEFAULT false,
  "status" "sr_status" NOT NULL DEFAULT 'Draft',
  "physical_custody_status" "physical_custody_status" NOT NULL DEFAULT 'WithClient',
  "current_custodian" text,
  "current_responsible_staff_id" varchar REFERENCES "users"("id"),
  "service_fee_aed" numeric(10, 2),
  "internal_notes" text,
  "created_by" varchar NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_attest_sr_company_id" ON "attestation_service_requests" ("company_id");
CREATE INDEX IF NOT EXISTS "idx_attest_sr_vendor_id" ON "attestation_service_requests" ("vendor_id");
CREATE INDEX IF NOT EXISTS "idx_attest_sr_status" ON "attestation_service_requests" ("status");

-- Create attestation_sr_steps table
CREATE TABLE IF NOT EXISTS "attestation_sr_steps" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "sr_id" varchar NOT NULL REFERENCES "attestation_service_requests"("id") ON DELETE CASCADE,
  "step_order" integer NOT NULL,
  "step_name" text NOT NULL,
  "step_type" "attestation_category" NOT NULL,
  "status" "sr_step_status" NOT NULL DEFAULT 'Pending',
  "started_at" timestamp,
  "completed_at" timestamp,
  "notes" text
);

CREATE INDEX IF NOT EXISTS "idx_attest_sr_steps_sr_id" ON "attestation_sr_steps" ("sr_id");
