import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";
import pg from "pg";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "exceljs",
  "zod",
  "zod-validation-error",
];

async function runPreDeployMigrations() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return;
  const pool = new pg.Pool({ connectionString: dbUrl });
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'staff' AND column_name = 'leave_end_date'
    `);
    const colType = rows[0]?.data_type;
    if (colType === 'text') {
      await client.query(`UPDATE staff SET leave_end_date = NULL WHERE leave_end_date IS NOT NULL AND leave_end_date != '' AND leave_end_date !~ '^\\d{4}-\\d{2}-\\d{2}'`);
      await client.query(`ALTER TABLE staff ALTER COLUMN leave_end_date TYPE DATE USING CASE WHEN leave_end_date IS NOT NULL AND leave_end_date != '' THEN leave_end_date::DATE ELSE NULL END`);
      console.log("[pre-deploy] Converted staff.leave_end_date from text to date");
    } else if (colType === 'timestamp without time zone' || colType === 'timestamp') {
      await client.query(`ALTER TABLE staff ALTER COLUMN leave_end_date TYPE DATE USING leave_end_date::DATE`);
      console.log("[pre-deploy] Converted staff.leave_end_date from timestamp to date");
    }

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

    const enumDefs: [string, string[]][] = [
      ["center_type", ["Medical", "EID", "Both"]],
      ["center_authority", ["DHA", "EHS", "ICP"]],
      ["center_tier", ["Normal", "VIP"]],
      ["wo_status", ["Draft", "AtVendor", "ReadyToSchedule", "Scheduled", "Completed", "Cancelled"]],
      ["appointment_type", ["Medical", "EID"]],
      ["appointment_status", ["Scheduled", "Completed", "Cancelled", "Rescheduled", "FollowUpRequired", "FollowUpScheduled", "FollowUpCompleted"]],
      ["reschedule_status", ["New", "Accepted", "Closed"]],
      ["document_status", ["Pending", "Uploaded", "Verified"]],
      ["message_channel", ["Email", "WhatsApp"]],
      ["message_status", ["Draft", "MarkedSent", "Failed"]],
      ["wallet_entry_type", ["Topup", "Debit", "Reversal", "Adjustment"]],
      ["staff_status", ["Active", "OnLeave", "Cancelled", "TempActive", "TempInactive"]],
      ["staff_type", ["Permanent", "Temporary"]],
      ["approval_status", ["Pending", "Approved", "Rejected"]],
      ["password_reset_status", ["pending", "approved", "rejected"]],
      ["vendor_type", ["Typing", "Attestation"]],
      ["document_class", ["Personal", "Business", "Both"]],
      ["sr_status", ["Draft", "SentToVendor", "AcceptedByVendor", "InProgress", "Completed", "Cancelled"]],
      ["physical_custody_status", ["WithClient", "WithUs", "WithVendor", "ReturnedToClient"]],
      ["sr_step_status", ["Pending", "InProgress", "Done"]],
      ["medical_appt_status", ["SCHEDULED", "AWAITING_MEETING", "IN_PROCESS", "COMPLETED", "RESULT_DELAYED", "RESULT_ISSUED", "MEDICAL_FAILED", "NO_SHOW", "RETEST_REQUIRED", "CLOSED_ADMIN_OVERRIDE"]],
      ["cycle_type", ["Initial", "Reschedule", "Retest"]],
      ["cycle_outcome", ["Passed", "Failed", "Pending"]],
      ["medical_event_type", ["CYCLE_CREATED", "STATUS_CHANGED", "QR_CONFIRMED", "MANUAL_CONFIRMED", "CRM_HOLD_SET", "CRM_HOLD_REMOVED", "COMPLETED_MARKED", "RETEST_REQUIRED_SET", "ADMIN_OVERRIDE", "RESULT_ISSUED", "MEDICAL_FAILED", "TIMER_AWAITING_MEETING", "TIMER_NO_SHOW", "TIMER_RESULT_DELAYED"]],
      ["biometrics_appt_status", ["SCHEDULED", "AWAITING_MEETING", "IN_PROCESS", "COMPLETED", "NO_SHOW", "RESCHEDULE_REQUIRED", "CLOSED_ADMIN_OVERRIDE"]],
      ["biometrics_cycle_type", ["Initial", "Reschedule"]],
      ["biometrics_cycle_outcome", ["Completed", "NoShow", "Pending"]],
      ["biometrics_event_type", ["CYCLE_CREATED", "STATUS_CHANGED", "QR_CONFIRMED", "MANUAL_CONFIRMED", "CRM_HOLD_SET", "CRM_HOLD_REMOVED", "COMPLETED_MARKED", "PROOF_UPLOADED", "RESCHEDULE_REQUIRED_SET", "ADMIN_OVERRIDE", "TIMER_AWAITING_MEETING", "TIMER_NO_SHOW"]],
      ["handover_direction", ["ClientToUs", "UsToVendor", "VendorToUs", "UsToClient"]],
      ["api_key_type", ["client", "crm"]],
      ["custody_doc_category", ["MofaPersonal", "MofaBusiness", "LawyerAttestation", "EmbassyAttestation"]],
      ["custody_doc_subtype", ["BirthCertificate", "MarriageCertificate", "EmbassyAffidavit", "AcademicCertificate", "PersonalPOA", "TradeLicense", "MOA", "BusinessPOA", "InternalCompanyDocuments", "PassportCopy", "ResidencyCopy", "UtilityBill", "Other"]],
      ["custody_doc_stage", ["WithClient", "WithUs", "WithVendor", "ReturnedToClient"]],
      ["attestation_inquiry_status", ["Open", "QuoteReceived", "Accepted", "Rejected", "Converted"]],
      ["attestation_document_class", ["Personal", "Business"]],
    ];

    for (const [name, values] of enumDefs) {
      const valuesStr = values.map(v => `'${v}'`).join(", ");
      await client.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${name}') THEN CREATE TYPE ${name} AS ENUM (${valuesStr}); END IF; END $$`);
    }
    console.log("[pre-deploy] All enums ensured");
  } catch (err) {
    console.warn("[pre-deploy] Pre-migration warning:", err instanceof Error ? err.message : err);
  } finally {
    client.release();
    await pool.end();
  }
}

async function buildAll() {
  await runPreDeployMigrations();
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
