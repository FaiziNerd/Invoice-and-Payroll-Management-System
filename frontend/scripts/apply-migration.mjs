/**
 * Apply migrate-multi-company.sql when SUPABASE_DB_URL is set in .env.local
 * Format: postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
 */
import pg from "pg";
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

const dbUrl = env.SUPABASE_DB_URL || env.DATABASE_URL;
if (!dbUrl) {
  console.error(
    "Set SUPABASE_DB_URL in frontend/.env.local (Supabase → Project Settings → Database → Connection string)"
  );
  process.exit(1);
}

const sql = readFileSync(
  resolve(__dirname, "../../supabase/migrate-multi-company.sql"),
  "utf8"
);

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(sql);
  console.log("Migration applied successfully.");
} finally {
  await client.end();
}
