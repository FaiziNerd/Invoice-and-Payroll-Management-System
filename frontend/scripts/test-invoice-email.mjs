/**
 * Sends a real invoice email via the API (requires Resend + dev server).
 *
 * Env (.env.local):
 *   RESEND_API_KEY, RESEND_FROM_EMAIL
 *   TEST_EMAIL_TO — recipient (must be allowed by your Resend account)
 *
 *   cd frontend && npm run dev
 *   npm run test:invoice-email
 */
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "../.env.local"), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY = env.RESEND_API_KEY;
const FROM = env.RESEND_FROM_EMAIL;
const TEST_TO = env.TEST_EMAIL_TO || process.env.TEST_EMAIL_TO;

const DEMO_EMAIL = "demo@ipms.app";
const DEMO_PASSWORD = "DemoIPMS2026!";
const DEMO_SLUG = "northstar-operations";

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

async function detectApiBase() {
  if (process.env.API_BASE) return process.env.API_BASE;
  for (const port of [3000, 3001]) {
    try {
      const res = await fetch(`http://localhost:${port}/api/companies`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.status === 401 || res.status === 200) return `http://localhost:${port}`;
    } catch {
      // continue
    }
  }
  return "http://localhost:3000";
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function createCookieSession() {
  const jar = new Map();
  const supabase = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll() {
        return [...jar.entries()].map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) jar.set(name, value);
      },
    },
  });
  return {
    supabase,
    cookieHeader() {
      return [...jar.entries()].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
    },
    setCookie(name, value) {
      jar.set(name, value);
    },
  };
}

async function apiFetch(session, base, path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      Cookie: session.cookieHeader(),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const json = await res.json();
  return { res, json };
}

async function main() {
  assert(RESEND_KEY, "RESEND_API_KEY missing in .env.local");
  assert(FROM, "RESEND_FROM_EMAIL missing in .env.local");
  assert(TEST_TO, "TEST_EMAIL_TO missing — set your inbox in .env.local");

  const BASE = await detectApiBase();
  console.log(`Invoice email test → ${BASE}\n`);

  const { data: company } = await admin
    .from("companies")
    .select("id")
    .eq("slug", DEMO_SLUG)
    .maybeSingle();
  assert(company, `Demo company "${DEMO_SLUG}" not found — run npm run seed:demo first`);

  const { data: draft } = await admin
    .from("invoices")
    .select("id, invoice_number, client_id, status")
    .eq("company_id", company.id)
    .eq("status", "draft")
    .limit(1)
    .maybeSingle();
  assert(draft, "No draft invoice in demo company");

  await admin
    .from("clients")
    .update({ email: TEST_TO })
    .eq("id", draft.client_id);

  const session = createCookieSession();
  const { error: loginError } = await session.supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  assert(!loginError, `Login failed: ${loginError?.message}`);
  session.setCookie("ipms-active-company", company.id);

  const { count: historyBefore } = await admin
    .from("invoice_history")
    .select("*", { count: "exact", head: true })
    .eq("invoice_id", draft.id);

  const { res, json } = await apiFetch(session, BASE, `/api/invoices/${draft.id}/send-email`, {
    method: "POST",
    body: JSON.stringify({ mode: "send", userName: "Demo Test" }),
  });

  if (!res.ok || !json.success) {
    console.error("API error:", json);
    throw new Error(json.error?.message ?? `HTTP ${res.status}`);
  }

  assert(json.data.status === "sent", `Expected status sent, got ${json.data.status}`);

  const { count: historyAfter } = await admin
    .from("invoice_history")
    .select("id", { count: "exact", head: true })
    .eq("invoice_id", draft.id);

  assert((historyAfter ?? 0) > (historyBefore.count ?? 0), "History entry not created");

  const { data: lastHistory } = await admin
    .from("invoice_history")
    .select("action")
    .eq("invoice_id", draft.id)
    .order("timestamp", { ascending: false })
    .limit(1)
    .maybeSingle();

  assert(
    lastHistory?.action?.includes(TEST_TO),
    `History should mention recipient, got: ${lastHistory?.action}`
  );

  console.log("PASS — email API accepted send");
  console.log(`  Invoice: ${draft.invoice_number}`);
  console.log(`  To: ${TEST_TO}`);
  console.log(`  History: ${lastHistory?.action}`);
  console.log("\nCheck your inbox for the invoice email with share link.");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
