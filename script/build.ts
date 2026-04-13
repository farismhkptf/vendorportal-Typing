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
    if (colType === 'date') {
      await client.query(`ALTER TABLE staff ALTER COLUMN leave_end_date TYPE TIMESTAMP USING leave_end_date::TIMESTAMP`);
      console.log("[pre-deploy] Converted staff.leave_end_date from date to timestamp");
    } else if (colType === 'text') {
      await client.query(`UPDATE staff SET leave_end_date = NULL WHERE leave_end_date IS NOT NULL AND leave_end_date != '' AND leave_end_date !~ '^\\d{4}-\\d{2}-\\d{2}'`);
      await client.query(`ALTER TABLE staff ALTER COLUMN leave_end_date TYPE TIMESTAMP USING CASE WHEN leave_end_date IS NOT NULL AND leave_end_date != '' THEN leave_end_date::TIMESTAMP ELSE NULL END`);
      console.log("[pre-deploy] Converted staff.leave_end_date from text to timestamp");
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
