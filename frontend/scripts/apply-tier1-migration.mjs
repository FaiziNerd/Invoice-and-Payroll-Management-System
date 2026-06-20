/**
 * Apply Tier 1 migration via Supabase service role (Postgres REST).
 * Run: node scripts/apply-tier1-migration.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const migrationSql = readFileSync(
  resolve(__dirname, "../../supabase/migrate-tier1-money-trust.sql"),
  "utf8"
);

// Supabase JS cannot run arbitrary DDL — use Management API pg endpoint if available
const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const dbPassword = env.SUPABASE_DB_PASSWORD;

if (!dbPassword) {
  console.log(
    "Set SUPABASE_DB_PASSWORD in .env.local (Database password from Supabase dashboard), then re-run.\n" +
      "Or paste supabase/migrate-tier1-money-trust.sql into Supabase SQL Editor manually."
  );
  process.exit(1);
}

const connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

try {
  const pg = await import("pg");
  const client = new pg.default.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query(migrationSql);
  await client.end();
  console.log("Tier 1 migration applied successfully.");
} catch (err) {
  console.error("Migration failed:", err.message);
  console.log("\nFallback: run supabase/migrate-tier1-money-trust.sql in Supabase SQL Editor.");
  process.exit(1);
}
