import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { WalletService } from "./wallet-service";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { registerExternalRoutes } from "./external-routes";
import { pool } from "./db";
import { registerAuthRoutes } from "./routes/auth";
import { registerVendorPortalRoutes } from "./routes/vendor-portal";
import { registerTypingJobRoutes } from "./routes/typing-jobs";
import { registerSchedulingRoutes } from "./routes/scheduling";
import { registerAttestationRoutes } from "./routes/attestation";
import { registerDashboardRoutes } from "./routes/dashboard";
import { registerWorkOrderRoutes } from "./routes/work-orders";
import { registerEntityRoutes } from "./routes/entities";
import { registerAdminRoutes } from "./routes/admin";
import { registerAdminImportRoutes } from "./routes/admin-import";
import { registerIntegrationRoutes } from "./routes/integration";
import type { RouteDeps } from "./routes/types";
import { notifyStaffByRoles, notifySingleUser, notifyVendorUsers } from "./services/notification-service";
import { startBackgroundJobs } from "./services/background-jobs";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

async function runRoleRenameMigration(): Promise<void> {
  const client = await pool.connect();
  try {
    const enumCheck = await client.query(`
      SELECT enumlabel FROM pg_enum
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
      WHERE pg_type.typname = 'user_role' AND enumlabel = 'Medical Support'
    `);
    if (enumCheck.rows.length === 0) return;

    await client.query(`ALTER TYPE user_role RENAME VALUE 'Medical Support' TO 'PRO'`);
    await client.query(`ALTER TYPE user_role RENAME VALUE 'Medical Support - Temporary' TO 'PRO - Temporary'`);
    console.log("[migration] renamed user_role enum values: Medical Support -> PRO, Medical Support - Temporary -> PRO - Temporary");
  } finally {
    client.release();
  }
}

async function runIndexMigration(): Promise<void> {
  const client = await pool.connect();
  try {
    const fs = await import("fs");
    const path = await import("path");
    const sqlPath = path.join(process.cwd(), "migrations", "0006_add_indexes_and_convert_leave_end_date.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");
    const statements = sql
      .split(/;\s*$/m)
      .map(s => s.replace(/^\s*--.*$/gm, "").trim())
      .filter(s => s.length > 0);

    let applied = 0;
    for (const stmt of statements) {
      try {
        await client.query(stmt);
        applied++;
      } catch (stmtErr: unknown) {
        const msg = stmtErr instanceof Error ? stmtErr.message : String(stmtErr);
        if (msg.includes("already exists")) {
          continue;
        }
        console.warn("[migration] Index statement failed:", msg, "| SQL:", stmt.substring(0, 80));
      }
    }
    if (applied > 0) {
      console.log(`[migration] Applied ${applied} index statements from migration 0006`);
    }

    try {
      const colCheck = await client.query(`
        SELECT data_type FROM information_schema.columns
        WHERE table_name = 'staff' AND column_name = 'leave_end_date'
      `);
      const colType = colCheck.rows.length > 0 ? colCheck.rows[0].data_type : null;
      if (colType === 'text') {
        await client.query(`
          UPDATE staff SET leave_end_date = NULL
          WHERE leave_end_date IS NOT NULL
            AND leave_end_date != ''
            AND leave_end_date !~ '^\\d{4}-\\d{2}-\\d{2}'
        `);
        await client.query(`
          ALTER TABLE staff ALTER COLUMN leave_end_date TYPE DATE USING
            CASE WHEN leave_end_date IS NOT NULL AND leave_end_date != '' THEN leave_end_date::DATE ELSE NULL END
        `);
        console.log("[migration] Converted staff.leave_end_date from text to date");
      } else if (colType === 'timestamp without time zone' || colType === 'timestamp') {
        await client.query(`
          ALTER TABLE staff ALTER COLUMN leave_end_date TYPE DATE USING leave_end_date::DATE
        `);
        console.log("[migration] Converted staff.leave_end_date from timestamp to date");
      }
    } catch (leaveErr: unknown) {
      const msg = leaveErr instanceof Error ? leaveErr.message : String(leaveErr);
      console.error("[migration] leave_end_date conversion FAILED:", msg);
    }
  } finally {
    client.release();
  }
}

async function runAttestationCategoryMigration(): Promise<void> {
  const client = await pool.connect();
  try {
    // Note: attestation_categories is now in vendor schema (created by runVendorSchemaMigration)
    // Convert category column in vendor.attestation_services from enum to text if needed
    const svcColResult = await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'vendor' AND table_name = 'attestation_services' AND column_name = 'category'
    `);
    if (svcColResult.rows.length > 0 && svcColResult.rows[0].data_type === 'USER-DEFINED') {
      await client.query(`ALTER TABLE vendor.attestation_services ALTER COLUMN category TYPE TEXT USING category::TEXT`);
      console.log("[migration] converted vendor.attestation_services.category from enum to text");
    }

    const stepDefColResult = await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'vendor' AND table_name = 'attestation_service_step_definitions' AND column_name = 'step_type'
    `);
    if (stepDefColResult.rows.length > 0 && stepDefColResult.rows[0].data_type === 'USER-DEFINED') {
      await client.query(`ALTER TABLE vendor.attestation_service_step_definitions ALTER COLUMN step_type TYPE TEXT USING step_type::TEXT`);
      console.log("[migration] converted vendor.attestation_service_step_definitions.step_type from enum to text");
    }

    const srStepColResult = await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'vendor' AND table_name = 'attestation_sr_steps' AND column_name = 'step_type'
    `);
    if (srStepColResult.rows.length > 0 && srStepColResult.rows[0].data_type === 'USER-DEFINED') {
      await client.query(`ALTER TABLE vendor.attestation_sr_steps ALTER COLUMN step_type TYPE TEXT USING step_type::TEXT`);
      console.log("[migration] converted vendor.attestation_sr_steps.step_type from enum to text");
    }

    const enumResult = await client.query(`
      SELECT typname FROM pg_type WHERE typname = 'attestation_category'
    `);
    if (enumResult.rows.length > 0) {
      await client.query(`DROP TYPE IF EXISTS attestation_category`);
      console.log("[migration] dropped old attestation_category enum type");
    }

    await storage.seedAttestationCategories();
    console.log("[migration] attestation categories seeded");
  } finally {
    client.release();
  }
}

async function runVendorSchemaMigration(): Promise<void> {
  const client = await pool.connect();
  try {
    // Check if vendor schema already exists
    const schemaCheck = await client.query(`
      SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'vendor'
    `);
    // Also check if core tables exist (schema may exist but be empty after a DB migration)
    const tableCheck = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'vendor' AND table_name = 'vendor_notifications'
    `);
    if (schemaCheck.rows.length > 0 && tableCheck.rows.length > 0) {
      // Schema exists and is populated; apply incremental patches for any missing tables or columns

      // ── Notifications: add read_at column ──────────────────────────────────
      await client.query(`ALTER TABLE vendor.vendor_notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP`);

      // Migrate is_read=true → read_at for existing rows (one-time data migration)
      const isReadColCheck = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'vendor' AND table_name = 'vendor_notifications' AND column_name = 'is_read'
      `);
      if (isReadColCheck.rows.length > 0) {
        await client.query(`
          UPDATE vendor.vendor_notifications SET read_at = COALESCE(created_at, now()) WHERE is_read = true AND read_at IS NULL
        `);
        console.log("[migration] vendor.vendor_notifications: migrated is_read to read_at");
      }

      // ── vendor_users: add role and last_login_at ────────────────────────────
      await client.query(`ALTER TABLE vendor.vendor_users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'operator'`);
      await client.query(`ALTER TABLE vendor.vendor_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP`);

      // ── cross_portal_events: add all required columns ───────────────────────
      // New schema: idempotency_key, aggregate_type, aggregate_id, attempt_count,
      // last_attempt_at, error_message. Old columns retry_count/source_portal/target_portal removed.
      // idempotency_key: migrate from UUID to TEXT (TEXT is more flexible for composite keys)
      // First add as nullable TEXT if it doesn't exist yet
      await client.query(`ALTER TABLE vendor.cross_portal_events ADD COLUMN IF NOT EXISTS idempotency_key TEXT`);
      // Change type from UUID to TEXT if column was previously UUID
      await client.query(`
        DO $$ BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='vendor' AND table_name='cross_portal_events' AND column_name='idempotency_key' AND data_type='uuid'
          ) THEN
            ALTER TABLE vendor.cross_portal_events ALTER COLUMN idempotency_key TYPE TEXT USING idempotency_key::TEXT;
          END IF;
        END $$
      `);
      // Back-fill NULL idempotency_key rows with generated values, then enforce NOT NULL
      await client.query(`UPDATE vendor.cross_portal_events SET idempotency_key = gen_random_uuid()::TEXT WHERE idempotency_key IS NULL`);
      await client.query(`ALTER TABLE vendor.cross_portal_events ALTER COLUMN idempotency_key SET NOT NULL`);
      // Add source_app column (always 'vendor_portal' for this event bus)
      await client.query(`ALTER TABLE vendor.cross_portal_events ADD COLUMN IF NOT EXISTS source_app TEXT NOT NULL DEFAULT 'vendor_portal'`);
      await client.query(`ALTER TABLE vendor.cross_portal_events ADD COLUMN IF NOT EXISTS aggregate_type TEXT`);
      await client.query(`ALTER TABLE vendor.cross_portal_events ADD COLUMN IF NOT EXISTS aggregate_id UUID`);
      await client.query(`ALTER TABLE vendor.cross_portal_events ADD COLUMN IF NOT EXISTS company_id UUID`);
      await client.query(`ALTER TABLE vendor.cross_portal_events ADD COLUMN IF NOT EXISTS created_by UUID`);
      await client.query(`ALTER TABLE vendor.cross_portal_events ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0`);
      await client.query(`ALTER TABLE vendor.cross_portal_events ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP`);
      await client.query(`ALTER TABLE vendor.cross_portal_events ADD COLUMN IF NOT EXISTS error_message TEXT`);
      // Back-fill aggregate_type/aggregate_id from event_type for rows inserted before schema update
      await client.query(`UPDATE vendor.cross_portal_events SET aggregate_type = 'typing_job', aggregate_id = (payload->>'typingJobId')::UUID WHERE aggregate_type IS NULL AND payload ? 'typingJobId'`);
      // Add unique constraint on idempotency_key if not exists
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_schema='vendor' AND table_name='cross_portal_events' AND constraint_name='uq_cross_portal_events_idempotency_key'
          ) THEN
            ALTER TABLE vendor.cross_portal_events ADD CONSTRAINT uq_cross_portal_events_idempotency_key UNIQUE (idempotency_key);
          END IF;
        END $$
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_cross_portal_events_event_type ON vendor.cross_portal_events (event_type)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_cross_portal_events_aggregate ON vendor.cross_portal_events (aggregate_type, aggregate_id)`);

      // ── Client Portal integration columns ──────────────────────────────────
      await client.query(`ALTER TABLE vendor.app_settings ADD COLUMN IF NOT EXISTS vp_client_portal_webhook_url TEXT`);
      await client.query(`ALTER TABLE vendor.app_settings ADD COLUMN IF NOT EXISTS vp_client_portal_outbound_api_key TEXT`);
      await client.query(`ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS external_wo_id TEXT`);
      console.log("[migration] client portal integration columns ensured");

      // ── Missing execution tables (added in 0008 update) ─────────────────────
      await client.query(`
        CREATE TABLE IF NOT EXISTS vendor.attestation_categories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL UNIQUE,
          sort_order INTEGER NOT NULL DEFAULT 0,
          active BOOLEAN NOT NULL DEFAULT true
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS vendor.attestation_services (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          document_class_applicability TEXT NOT NULL DEFAULT 'Both',
          base_price_aed NUMERIC(10,2) NOT NULL DEFAULT 0,
          timeline_days INTEGER,
          description TEXT,
          active BOOLEAN NOT NULL DEFAULT true
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS vendor.attestation_service_variants (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          service_id UUID NOT NULL,
          variant_label TEXT NOT NULL,
          price_aed NUMERIC(10,2) NOT NULL DEFAULT 0,
          timeline_days INTEGER,
          active BOOLEAN NOT NULL DEFAULT true
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS vendor.attestation_service_step_definitions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          service_id UUID NOT NULL,
          step_order INTEGER NOT NULL,
          step_name TEXT NOT NULL,
          step_type TEXT NOT NULL,
          description TEXT
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS vendor.job_types (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'Medical',
          description TEXT,
          cost INTEGER NOT NULL,
          active BOOLEAN NOT NULL DEFAULT true
        )
      `);
      // Add category if table already existed without it
      await client.query(`ALTER TABLE vendor.job_types ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Medical'`);

      await client.query(`
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
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS vendor.typing_job_comments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          typing_job_id UUID NOT NULL,
          author_type TEXT NOT NULL,
          author_user_id UUID,
          message TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `);

      await client.query(`
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
        )
      `);

      // ── Staff Notifications table ────────────────────────────────────────────
      await client.query(`
        CREATE TABLE IF NOT EXISTS vendor.staff_notifications (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
          user_id VARCHAR NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          related_entity_type TEXT,
          related_entity_id VARCHAR,
          is_read BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_vendor_staff_notifications_user_id ON vendor.staff_notifications (user_id)`);

      // ── Attestation Inquiry tables (moved to vendor schema) ─────────────────
      await client.query(`
        CREATE TABLE IF NOT EXISTS vendor.attestation_inquiries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID NOT NULL,
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
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_vendor_attest_inquiries_company_id ON vendor.attestation_inquiries (company_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_vendor_attest_inquiries_vendor_id ON vendor.attestation_inquiries (vendor_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_vendor_attest_inquiries_status ON vendor.attestation_inquiries (status)`);

      await client.query(`
        CREATE TABLE IF NOT EXISTS vendor.attestation_inquiry_quotes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          inquiry_id UUID NOT NULL,
          vendor_id UUID NOT NULL,
          submitted_by_vendor_user_id UUID,
          quote_version INTEGER NOT NULL DEFAULT 1,
          amount_aed INTEGER NOT NULL,
          timeline_days INTEGER NOT NULL,
          notes TEXT,
          submitted_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_vendor_attest_quotes_inquiry_id ON vendor.attestation_inquiry_quotes (inquiry_id)`);

      // ── Document Custody tables (moved to vendor schema) ────────────────────
      await client.query(`
        CREATE TABLE IF NOT EXISTS vendor.document_custody_records (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          reference_number VARCHAR(20) NOT NULL UNIQUE,
          company_id UUID NOT NULL,
          work_order_id UUID,
          sr_id UUID,
          doc_category TEXT NOT NULL,
          doc_subtype TEXT NOT NULL,
          doc_custom_name TEXT,
          custody_stage TEXT NOT NULL DEFAULT 'WithClient',
          notify_email TEXT,
          notes TEXT,
          created_by UUID,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_vendor_doc_custody_records_company_id ON vendor.document_custody_records (company_id)`);
      // Normalize column name: rename wo_id → work_order_id for consistency
      await client.query(`
        DO $$ BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='vendor' AND table_name='document_custody_records' AND column_name='wo_id'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='vendor' AND table_name='document_custody_records' AND column_name='work_order_id'
          ) THEN
            ALTER TABLE vendor.document_custody_records RENAME COLUMN wo_id TO work_order_id;
          END IF;
        END $$
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_vendor_doc_custody_records_work_order_id ON vendor.document_custody_records (work_order_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_vendor_doc_custody_records_sr_id ON vendor.document_custody_records (sr_id)`);

      await client.query(`
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
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_vendor_doc_custody_handoffs_record_id ON vendor.document_custody_handoffs (record_id)`);

      // ── app_settings: add optional columns ─────────────────────────────────
      await client.query(`ALTER TABLE vendor.app_settings ADD COLUMN IF NOT EXISTS vp_privacy_policy_html TEXT`);
      await client.query(`ALTER TABLE vendor.app_settings ADD COLUMN IF NOT EXISTS vp_terms_of_service_html TEXT`);

      // ── Cross-schema FK constraints ─────────────────────────────────────────
      // These are guarded with IF NOT EXISTS checks so they are idempotent.
      const fkPatches: Array<{ name: string; sql: string }> = [
        {
          name: "fk_typing_jobs_work_order_id",
          sql: `ALTER TABLE vendor.typing_jobs ADD CONSTRAINT fk_typing_jobs_work_order_id FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
        },
        {
          name: "fk_typing_jobs_vendor_id",
          sql: `ALTER TABLE vendor.typing_jobs ADD CONSTRAINT fk_typing_jobs_vendor_id FOREIGN KEY (vendor_id) REFERENCES vendor.vendors(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
        },
        {
          name: "fk_vendor_approvals_typing_job_id",
          sql: `ALTER TABLE vendor.vendor_approvals ADD CONSTRAINT fk_vendor_approvals_typing_job_id FOREIGN KEY (typing_job_id) REFERENCES vendor.typing_jobs(id) ON DELETE CASCADE ON UPDATE CASCADE`,
        },
        {
          name: "fk_vendor_approvals_vendor_id",
          sql: `ALTER TABLE vendor.vendor_approvals ADD CONSTRAINT fk_vendor_approvals_vendor_id FOREIGN KEY (vendor_id) REFERENCES vendor.vendors(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
        },
        {
          name: "fk_doc_custody_records_company_id",
          sql: `ALTER TABLE vendor.document_custody_records ADD CONSTRAINT fk_doc_custody_records_company_id FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
        },
        {
          name: "fk_doc_custody_records_work_order_id",
          sql: `ALTER TABLE vendor.document_custody_records ADD CONSTRAINT fk_doc_custody_records_work_order_id FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
        },
        {
          name: "fk_doc_custody_handoffs_record_id",
          sql: `ALTER TABLE vendor.document_custody_handoffs ADD CONSTRAINT fk_doc_custody_handoffs_record_id FOREIGN KEY (record_id) REFERENCES vendor.document_custody_records(id) ON DELETE CASCADE ON UPDATE CASCADE`,
        },
        {
          name: "fk_cross_portal_events_work_order_id",
          sql: `ALTER TABLE vendor.cross_portal_events ADD CONSTRAINT fk_cross_portal_events_work_order_id FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
        },
        {
          name: "fk_cross_portal_events_company_id",
          sql: `ALTER TABLE vendor.cross_portal_events ADD CONSTRAINT fk_cross_portal_events_company_id FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
        },
        {
          name: "fk_vendor_wallet_ledger_vendor_id",
          sql: `ALTER TABLE vendor.vendor_wallet_ledger ADD CONSTRAINT fk_vendor_wallet_ledger_vendor_id FOREIGN KEY (vendor_id) REFERENCES vendor.vendors(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
        },
        {
          name: "fk_vendor_notifications_vendor_id",
          sql: `ALTER TABLE vendor.vendor_notifications ADD CONSTRAINT fk_vendor_notifications_vendor_id FOREIGN KEY (vendor_id) REFERENCES vendor.vendors(id) ON DELETE CASCADE ON UPDATE CASCADE`,
        },
        {
          name: "fk_medical_cases_work_order_id",
          sql: `ALTER TABLE vendor.medical_cases ADD CONSTRAINT fk_medical_cases_work_order_id FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
        },
        {
          name: "fk_biometrics_cases_work_order_id",
          sql: `ALTER TABLE vendor.biometrics_cases ADD CONSTRAINT fk_biometrics_cases_work_order_id FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
        },
        {
          name: "fk_attest_sr_company_id",
          sql: `ALTER TABLE vendor.attestation_service_requests ADD CONSTRAINT fk_attest_sr_company_id FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
        },
        {
          name: "fk_attest_sr_vendor_id",
          sql: `ALTER TABLE vendor.attestation_service_requests ADD CONSTRAINT fk_attest_sr_vendor_id FOREIGN KEY (vendor_id) REFERENCES vendor.vendors(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
        },
        {
          name: "fk_attest_inquiries_company_id",
          sql: `ALTER TABLE vendor.attestation_inquiries ADD CONSTRAINT fk_attest_inquiries_company_id FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
        },
        {
          name: "fk_attest_inquiries_vendor_id",
          sql: `ALTER TABLE vendor.attestation_inquiries ADD CONSTRAINT fk_attest_inquiries_vendor_id FOREIGN KEY (vendor_id) REFERENCES vendor.vendors(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
        },
        {
          name: "fk_attest_quotes_inquiry_id",
          sql: `ALTER TABLE vendor.attestation_inquiry_quotes ADD CONSTRAINT fk_attest_quotes_inquiry_id FOREIGN KEY (inquiry_id) REFERENCES vendor.attestation_inquiries(id) ON DELETE CASCADE ON UPDATE CASCADE`,
        },
        {
          name: "fk_attest_quotes_vendor_id",
          sql: `ALTER TABLE vendor.attestation_inquiry_quotes ADD CONSTRAINT fk_attest_quotes_vendor_id FOREIGN KEY (vendor_id) REFERENCES vendor.vendors(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
        },
        {
          name: "fk_vendor_users_vendor_id",
          sql: `ALTER TABLE vendor.vendor_users ADD CONSTRAINT fk_vendor_users_vendor_id FOREIGN KEY (vendor_id) REFERENCES vendor.vendors(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
        },
      ];

      for (const { name, sql } of fkPatches) {
        const exists = await client.query(`
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_schema = 'vendor' AND constraint_name = $1
        `, [name]);
        if (exists.rows.length === 0) {
          try {
            await client.query(sql);
            console.log(`[migration] FK constraint added: ${name}`);
          } catch (fkErr: unknown) {
            // FK may fail if referencing table has orphaned rows — log and continue
            const msg = fkErr instanceof Error ? fkErr.message : String(fkErr);
            console.warn(`[migration] FK constraint skipped (${name}): ${msg}`);
          }
        }
      }

      // ── Data migration from public tables (one-time, for existing deployments) ──
      // attestation_categories: VARCHAR id → UUID
      {
        const srcCheck = await client.query(`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='attestation_categories'`);
        if (srcCheck.rows.length > 0) {
          const countCheck = await client.query(`SELECT COUNT(*) as cnt FROM vendor.attestation_categories`);
          if (parseInt(countCheck.rows[0].cnt) === 0) {
            try {
              await client.query(`INSERT INTO vendor.attestation_categories (id, name, sort_order, active) SELECT id::UUID, name, sort_order, active FROM public.attestation_categories ON CONFLICT DO NOTHING`);
              console.log(`[migration] vendor.attestation_categories: migrated from public`);
            } catch (e: unknown) { console.warn(`[migration] attestation_categories migration: ${e instanceof Error ? e.message : e}`); }
          }
        }
      }

      // attestation_services: VARCHAR id → UUID, may need category::TEXT cast
      {
        const srcCheck = await client.query(`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='attestation_services'`);
        if (srcCheck.rows.length > 0) {
          const countCheck = await client.query(`SELECT COUNT(*) as cnt FROM vendor.attestation_services`);
          if (parseInt(countCheck.rows[0].cnt) === 0) {
            try {
              await client.query(`INSERT INTO vendor.attestation_services (id, name, category, document_class_applicability, base_price_aed, timeline_days, description, active) SELECT id::UUID, name, category::TEXT, document_class_applicability::TEXT, base_price_aed, timeline_days, description, active FROM public.attestation_services ON CONFLICT DO NOTHING`);
              console.log(`[migration] vendor.attestation_services: migrated from public`);
            } catch (e: unknown) { console.warn(`[migration] attestation_services migration: ${e instanceof Error ? e.message : e}`); }
          }
        }
      }

      // attestation_service_variants: VARCHAR id → UUID, service_id VARCHAR → UUID
      {
        const srcCheck = await client.query(`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='attestation_service_variants'`);
        if (srcCheck.rows.length > 0) {
          const countCheck = await client.query(`SELECT COUNT(*) as cnt FROM vendor.attestation_service_variants`);
          if (parseInt(countCheck.rows[0].cnt) === 0) {
            try {
              await client.query(`INSERT INTO vendor.attestation_service_variants (id, service_id, variant_label, price_aed, timeline_days, active) SELECT id::UUID, service_id::UUID, variant_label, price_aed, timeline_days, active FROM public.attestation_service_variants ON CONFLICT DO NOTHING`);
              console.log(`[migration] vendor.attestation_service_variants: migrated from public`);
            } catch (e: unknown) { console.warn(`[migration] attestation_service_variants migration: ${e instanceof Error ? e.message : e}`); }
          }
        }
      }

      // attestation_service_step_definitions: VARCHAR id → UUID, service_id VARCHAR → UUID
      {
        const srcCheck = await client.query(`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='attestation_service_step_definitions'`);
        if (srcCheck.rows.length > 0) {
          const countCheck = await client.query(`SELECT COUNT(*) as cnt FROM vendor.attestation_service_step_definitions`);
          if (parseInt(countCheck.rows[0].cnt) === 0) {
            try {
              await client.query(`INSERT INTO vendor.attestation_service_step_definitions (id, service_id, step_order, step_name, step_type, description) SELECT id::UUID, service_id::UUID, step_order, step_name, step_type::TEXT, description FROM public.attestation_service_step_definitions ON CONFLICT DO NOTHING`);
              console.log(`[migration] vendor.attestation_service_step_definitions: migrated from public`);
            } catch (e: unknown) { console.warn(`[migration] attestation_service_step_definitions migration: ${e instanceof Error ? e.message : e}`); }
          }
        }
      }

      // job_types separately (category column is enum in public, text in vendor)
      const srcJobTypesCheck = await client.query(`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='job_types'`);
      if (srcJobTypesCheck.rows.length > 0) {
        const countCheck = await client.query(`SELECT COUNT(*) as cnt FROM vendor.job_types`);
        if (parseInt(countCheck.rows[0].cnt) === 0) {
          try {
            await client.query(`INSERT INTO vendor.job_types (id, name, category, cost, active) SELECT id::UUID, name, category::TEXT, cost, active FROM public.job_types ON CONFLICT DO NOTHING`);
            console.log(`[migration] vendor.job_types: migrated data from public.job_types`);
          } catch (migrErr: unknown) {
            const msg = migrErr instanceof Error ? migrErr.message : String(migrErr);
            console.warn(`[migration] vendor.job_types data migration failed: ${msg}`);
          }
        }
      }

      // Migrate vendor users from public.users to vendor.vendor_users
      // vendor.vendor_users is the authoritative identity store for Vendor Portal logins
      {
        const vuCountCheck = await client.query(`SELECT COUNT(*) as cnt FROM vendor.vendor_users`);
        if (parseInt(vuCountCheck.rows[0].cnt) === 0) {
          try {
            await client.query(`
              INSERT INTO vendor.vendor_users (id, vendor_id, name, email, password_hash, role, active, created_at)
              SELECT u.id::UUID, u.vendor_id::UUID, u.name, u.email, u.password_hash, 'operator', true, u.created_at
              FROM public.users u
              WHERE u.role = 'Vendor' AND u.vendor_id IS NOT NULL
              ON CONFLICT (email) DO NOTHING
            `);
            console.log(`[migration] vendor.vendor_users: migrated vendor accounts from public.users`);
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            console.warn(`[migration] vendor.vendor_users migration failed: ${msg}`);
          }
        }
      }

      console.log("[migration] vendor schema incremental patches applied");
      return;
    }

    const fs = await import("fs");
    const path = await import("path");
    const sqlPath = path.join(process.cwd(), "migrations", "0008_vendor_schema_migration.sql");
    const sqlContent = fs.readFileSync(sqlPath, "utf-8");

    // Run the migration — the SQL file includes its own BEGIN/COMMIT block
    try {
      await client.query(sqlContent);
      console.log("[migration] Vendor schema migration (0008) applied successfully");
    } catch (err) {
      throw err;
    }
  } finally {
    client.release();
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerObjectStorageRoutes(app);
  registerExternalRoutes(app);

  // Run vendor schema migration FIRST before seeding (seedData depends on vendor schema tables)
  try {
    await runVendorSchemaMigration();
  } catch (migErr) {
    console.error("[migration] vendor schema migration error:", migErr);
    // Re-throw — the app cannot function without the vendor schema
    throw migErr;
  }

  await storage.seedData();

  try {
    await runRoleRenameMigration();
  } catch (migErr) {
    console.error("[migration] role rename migration error:", migErr);
  }

  try {
    await runAttestationCategoryMigration();
  } catch (migErr) {
    console.error("[migration] attestation category migration error:", migErr);
  }

  try {
    await runIndexMigration();
  } catch (migErr) {
    console.error("[migration] index migration error:", migErr);
  }

  startBackgroundJobs();

  const walletService = new WalletService(storage, notifyVendorUsers);
  const routeDeps: RouteDeps = { walletService, upload, notifyVendorUsers, notifyStaffByRoles, notifySingleUser };

  registerDashboardRoutes(app, routeDeps);
  registerWorkOrderRoutes(app, routeDeps);
  registerEntityRoutes(app, routeDeps);
  registerTypingJobRoutes(app, routeDeps);
  registerAdminRoutes(app, routeDeps);
  registerAuthRoutes(app);
  registerVendorPortalRoutes(app, routeDeps);
  registerAdminImportRoutes(app, routeDeps);
  registerSchedulingRoutes(app, routeDeps);
  registerAttestationRoutes(app, routeDeps);
  registerIntegrationRoutes(app);

  return httpServer;
}
