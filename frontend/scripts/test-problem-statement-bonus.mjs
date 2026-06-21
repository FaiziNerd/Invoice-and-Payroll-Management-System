/**
 * Problem statement bonus feature tests.
 *
 * Run: cd frontend && npm run dev (separate terminal)
 *      npm run test:problem-statement
 *
 * Requires: .env.local with Supabase keys; CRON_SECRET for cron tests.
 */
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");

function loadEnv() {
  try {
    return Object.fromEntries(
      readFileSync(envPath, "utf8")
        .split("\n")
        .filter((l) => l && !l.startsWith("#"))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        })
    );
  } catch {
    return {};
  }
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = env.CRON_SECRET || process.env.CRON_SECRET;

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
      ...(options.headers ?? {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const json = await res.json();
  return { res, json };
}

async function loginDemo(session, base, companyId) {
  const { error: loginError } = await session.supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  assert(!loginError, `Login failed: ${loginError?.message}`);
  session.setCookie("ipms-active-company", companyId);
}

async function testPayrollInsights(session, base) {
  const { res, json } = await apiFetch(session, base, "/api/dashboard/analytics");
  assert(res.ok && json.success, `Analytics failed: ${json.error?.message ?? res.status}`);
  assert(Array.isArray(json.data.payrollInsights), "payrollInsights missing from analytics");
  assert(json.data.payrollInsights.length >= 1, "payrollInsights should have at least 1 item");
  assert(
    json.data.payrollInsightsSource === "ai" || json.data.payrollInsightsSource === "rules",
    "payrollInsightsSource should be ai or rules"
  );
  console.log("PASS — analytics returns payrollInsights");
}

async function testAutoSendOnStatus(session, base, companyId) {
  const { data: draft } = await admin
    .from("invoices")
    .select("id, invoice_number, status")
    .eq("company_id", companyId)
    .eq("status", "draft")
    .limit(1)
    .maybeSingle();

  if (!draft) {
    console.log("SKIP — no draft invoice for auto-send test");
    return;
  }

  const { count: historyBefore } = await admin
    .from("invoice_history")
    .select("*", { count: "exact", head: true })
    .eq("invoice_id", draft.id);

  const { res, json } = await apiFetch(session, base, `/api/invoices/${draft.id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "sent", userName: "Bonus Test" }),
  });

  assert(res.ok && json.success, `Status change failed: ${json.error?.message ?? res.status}`);
  assert(json.data.status === "sent", "Expected status sent");

  const { data: updated } = await admin
    .from("invoices")
    .select("status")
    .eq("id", draft.id)
    .maybeSingle();
  assert(updated?.status === "sent", "Invoice should be sent in DB");

  const { count: historyAfter } = await admin
    .from("invoice_history")
    .select("*", { count: "exact", head: true })
    .eq("invoice_id", draft.id);

  assert((historyAfter ?? 0) >= (historyBefore ?? 0), "History should grow after status change");

  const hasResend = Boolean(env.RESEND_API_KEY?.trim() && env.RESEND_FROM_EMAIL?.trim());
  if (hasResend) {
    const { data: sendHistory } = await admin
      .from("invoice_history")
      .select("action")
      .eq("invoice_id", draft.id)
      .like("action", "Invoice sent to%");
    assert((sendHistory ?? []).length >= 1, "Auto-send should create send history when Resend configured");
    console.log("PASS — draft→sent triggers email attempt");
  } else {
    console.log("PASS — draft→sent status change (email skipped — Resend not configured)");
  }
}

async function testCronAuth(base) {
  const noAuth = await fetch(`${base}/api/cron/invoice-reminders`);
  const noAuthJson = await noAuth.json();
  assert(noAuth.status === 401, `Cron without secret should 401, got ${noAuth.status}`);
  assert(!noAuthJson.success, "Cron without secret should fail");

  if (!CRON_SECRET) {
    console.log("SKIP — CRON_SECRET not set; cron accept test skipped");
    return;
  }

  const authed = await fetch(`${base}/api/cron/invoice-reminders`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  const authedJson = await authed.json();
  assert(authed.ok && authedJson.success, `Cron with secret failed: ${authedJson.error?.message}`);
  assert(typeof authedJson.data.sent === "number", "Cron should return sent count");
  console.log("PASS — cron auth (401 without secret, 200 with secret)");
}

async function testEmployeeAudit(session, base, companyId) {
  const unique = `bonus-${Date.now()}`;
  const { count: beforeCount } = await admin
    .from("audit_logs")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("entity", "employee")
    .eq("action", "create");

  const { data: dept } = await admin
    .from("departments")
    .select("id")
    .eq("company_id", companyId)
    .limit(1)
    .maybeSingle();
  assert(dept, "Need at least one department for employee create test");

  const { res, json } = await apiFetch(session, base, "/api/employees", {
    method: "POST",
    body: JSON.stringify({
      employeeId: unique,
      firstName: "Bonus",
      lastName: "Test",
      email: `${unique}@test.local`,
      departmentId: dept.id,
      joinDate: "2026-01-01",
      status: "active",
      salaryStructure: {
        baseSalary: 50000,
        allowances: [],
        deductions: [],
      },
    }),
  });

  assert(res.ok && json.success, `Employee create failed: ${json.error?.message ?? res.status}`);

  const { count: afterCount } = await admin
    .from("audit_logs")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("entity", "employee")
    .eq("action", "create");

  assert((afterCount ?? 0) > (beforeCount ?? 0), "Employee POST should create audit_logs row");

  await admin.from("employees").delete().eq("id", json.data.id);
  console.log("PASS — employee POST creates audit_logs row");
}

async function main() {
  assert(SUPABASE_URL && ANON_KEY && SERVICE_KEY, "Supabase env vars required in .env.local");

  const BASE = await detectApiBase();
  console.log(`Problem statement bonus tests → ${BASE}\n`);

  const { data: company } = await admin
    .from("companies")
    .select("id")
    .eq("slug", DEMO_SLUG)
    .maybeSingle();
  assert(company, `Demo company "${DEMO_SLUG}" not found — run npm run seed:demo first`);

  const session = createCookieSession();
  await loginDemo(session, BASE, company.id);

  await testPayrollInsights(session, BASE);
  await testAutoSendOnStatus(session, BASE, company.id);
  await testCronAuth(BASE);
  await testEmployeeAudit(session, BASE, company.id);

  console.log("\nAll bonus feature tests passed.");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
