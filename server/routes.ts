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
      if (colCheck.rows.length > 0 && colCheck.rows[0].data_type === 'text') {
        await client.query(`
          UPDATE staff SET leave_end_date = NULL
          WHERE leave_end_date IS NOT NULL
            AND leave_end_date != ''
            AND leave_end_date !~ '^\\d{4}-\\d{2}-\\d{2}'
        `);
        await client.query(`
          ALTER TABLE staff ALTER COLUMN leave_end_date TYPE TIMESTAMP USING
            CASE WHEN leave_end_date IS NOT NULL AND leave_end_date != '' THEN leave_end_date::TIMESTAMP ELSE NULL END
        `);
        console.log("[migration] Converted staff.leave_end_date from text to timestamp");
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
    await client.query(`
      CREATE TABLE IF NOT EXISTS attestation_categories (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT true
      )
    `);

    const svcColResult = await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'attestation_services' AND column_name = 'category'
    `);
    if (svcColResult.rows.length > 0 && svcColResult.rows[0].data_type === 'USER-DEFINED') {
      await client.query(`ALTER TABLE attestation_services ALTER COLUMN category TYPE TEXT USING category::TEXT`);
      console.log("[migration] converted attestation_services.category from enum to text");
    }

    const stepDefColResult = await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'attestation_service_step_definitions' AND column_name = 'step_type'
    `);
    if (stepDefColResult.rows.length > 0 && stepDefColResult.rows[0].data_type === 'USER-DEFINED') {
      await client.query(`ALTER TABLE attestation_service_step_definitions ALTER COLUMN step_type TYPE TEXT USING step_type::TEXT`);
      console.log("[migration] converted attestation_service_step_definitions.step_type from enum to text");
    }

    const srStepColResult = await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'attestation_sr_steps' AND column_name = 'step_type'
    `);
    if (srStepColResult.rows.length > 0 && srStepColResult.rows[0].data_type === 'USER-DEFINED') {
      await client.query(`ALTER TABLE attestation_sr_steps ALTER COLUMN step_type TYPE TEXT USING step_type::TEXT`);
      console.log("[migration] converted attestation_sr_steps.step_type from enum to text");
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerObjectStorageRoutes(app);
  registerExternalRoutes(app);

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

  return httpServer;
}
