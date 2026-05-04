import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Prefer the Replit internal postgres (heliumdb) when PGHOST/PGDATABASE are set
// and DATABASE_URL points to a different database (e.g. Neon keystone_core which
// is the Client Portal DB). The PRO Portal data lives in heliumdb.
function buildConnectionConfig(): pg.PoolConfig {
  const pgHost = process.env.PGHOST;
  const pgDb = process.env.PGDATABASE;
  const pgUser = process.env.PGUSER || "postgres";
  const pgPort = parseInt(process.env.PGPORT || "5432", 10);
  const dbUrl = process.env.DATABASE_URL;

  // If we have PGHOST and PGDATABASE pointing to our internal postgres, prefer it
  if (pgHost && pgDb && pgDb !== "keystone_core") {
    return { host: pgHost, database: pgDb, user: pgUser, port: pgPort };
  }

  if (!dbUrl) {
    throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
  }
  return { connectionString: dbUrl };
}

export const pool = new Pool(buildConnectionConfig());
export const db = drizzle(pool, { schema });

export type DrizzleTx = Parameters<(typeof db)["transaction"]>[0] extends (tx: infer TX) => unknown ? TX : never;
