/**
 * Apply Tier 2 migration when SUPABASE_DB_PASSWORD is set in .env.local.
 * Run: node scripts/apply-tier2-migration.mjs
 */
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

const migrationSql = readFileSync(
  resolve(__dirname, "../../supabase/migrate-tier2-operational-reliability.sql"),
  "utf8"
);

const dbUrl = env.SUPABASE_DB_URL || env.DATABASE_URL;
const dbPassword = env.SUPABASE_DB_PASSWORD;
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;

if (!dbUrl && !dbPassword) {
  console.error(
    "Set SUPABASE_DB_PASSWORD or SUPABASE_DB_URL in frontend/.env.local, then re-run.\n" +
      "Or paste supabase/migrate-tier2-operational-reliability.sql into Supabase SQL Editor."
  );
  process.exit(1);
}

const connectionString =
  dbUrl ??
  `postgresql://postgres.${new URL(supabaseUrl).hostname.split(".")[0]}:${encodeURIComponent(dbPassword)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

try {
  const pg = await import("pg");
  const client = new pg.default.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query(migrationSql);
  await client.end();
  console.log("Tier 2 migration applied successfully.");
} catch (err) {
  console.error("Migration failed:", err.message);
  console.log(
    "\nFallback: run supabase/migrate-tier2-operational-reliability.sql in Supabase SQL Editor."
  );
  process.exit(1);
}
