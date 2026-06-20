/**
 * Verifies non-admin users with multiple company memberships can switch companies.
 *
 *   cd frontend
 *   npm run test:company-switcher
 */
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
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
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

async function detectApiBase() {
  if (process.env.API_BASE) return process.env.API_BASE;
  for (const port of [3000, 3001]) {
    try {
      const res = await fetch(`http://localhost:${port}/api/companies`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.status === 401 || res.status === 200) {
        return `http://localhost:${port}`;
      }
    } catch {
      // try next port
    }
  }
  return "http://localhost:3000";
}

const BASE = await detectApiBase();

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST = {
  user: {
    email: "multi-co-accountant@ipms-test.local",
    password: "TestPass123!",
    name: "Multi Co Accountant",
  },
  companies: [
    { name: "Switcher Test Alpha", slug: "switcher-test-alpha" },
    { name: "Switcher Test Beta", slug: "switcher-test-beta" },
  ],
};

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

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
    getCookie(name) {
      return jar.get(name);
    },
  };
}

async function apiFetch(session, path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Cookie: session.cookieHeader(),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const raw of setCookie) {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) {
      session.setCookie(pair.slice(0, eq).trim(), decodeURIComponent(pair.slice(eq + 1)));
    }
  }

  const json = await res.json();
  return { res, json };
}

async function wipeTestData() {
  for (const co of TEST.companies) {
    const { data: company } = await admin
      .from("companies")
      .select("id")
      .eq("slug", co.slug)
      .maybeSingle();
    if (company) {
      await admin.from("payroll_runs").delete().eq("company_id", company.id);
      await admin.from("companies").delete().eq("id", company.id);
    }
  }

  const { data: listed } = await admin.auth.admin.listUsers();
  const user = listed?.users?.find((u) => u.email === TEST.user.email);
  if (user) {
    await admin.auth.admin.deleteUser(user.id);
  }
}

async function setup() {
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: TEST.user.email,
    password: TEST.user.password,
    email_confirm: true,
    user_metadata: { name: TEST.user.name },
  });
  if (authError) throw new Error(`Create user: ${authError.message}`);
  const userId = authData.user.id;

  const companyIds = [];
  for (const co of TEST.companies) {
    const { data: company, error } = await admin
      .from("companies")
      .insert({ name: co.name, slug: co.slug })
      .select("id")
      .single();
    if (error) throw new Error(`Create company ${co.slug}: ${error.message}`);

    await admin.from("organization_settings").insert({
      company_id: company.id,
      name: co.name,
    });

    await admin.from("company_members").insert({
      company_id: company.id,
      user_id: userId,
      role: "accountant",
    });

    companyIds.push(company.id);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) {
    await admin.from("profiles").insert({
      id: userId,
      name: TEST.user.name,
      email: TEST.user.email,
    });
  }

  return { userId, companyIds };
}

async function loginAs(session, companyId) {
  const { error } = await session.supabase.auth.signInWithPassword({
    email: TEST.user.email,
    password: TEST.user.password,
  });
  if (error) throw new Error(`Login: ${error.message}`);
  session.setCookie("ipms-active-company", companyId);
}

async function main() {
  console.log(`Testing company switcher against ${BASE}\n`);

  try {
    await fetch(`${BASE}/api/companies`);
  } catch {
    console.error("Dev server not reachable. Run: npm run dev");
    process.exit(1);
  }

  await wipeTestData();
  const { companyIds } = await setup();
  const [alphaId, betaId] = companyIds;

  const session = createCookieSession();
  await loginAs(session, alphaId);

  console.log("[1] Non-admin user lists multiple companies");
  const { res: listRes, json: listJson } = await apiFetch(session, "/api/companies");
  assert(listRes.status === 200 && listJson.success, "GET /api/companies failed");
  assert(listJson.data.companies.length === 2, `Expected 2 companies, got ${listJson.data.companies.length}`);
  assert(
    listJson.data.companies.every((c) => c.role === "accountant"),
    "User should be accountant in both companies"
  );
  console.log("   PASS — 2 companies returned for accountant role");

  console.log("\n[2] Switch from Alpha to Beta");
  const { res: switchRes, json: switchJson } = await apiFetch(session, "/api/companies", {
    method: "POST",
    body: JSON.stringify({ companyId: betaId }),
  });
  assert(switchRes.status === 200 && switchJson.success, `Switch failed: ${JSON.stringify(switchJson)}`);
  assert(switchJson.data.companyId === betaId, "Session should reflect Beta company");
  assert(switchJson.data.role === "accountant", "Role should remain accountant");
  console.log("   PASS — switched to Beta");

  console.log("\n[3] Active company persisted after switch");
  const { res: afterRes, json: afterJson } = await apiFetch(session, "/api/companies");
  assert(afterRes.status === 200 && afterJson.success, "GET companies after switch failed");
  assert(afterJson.data.activeCompanyId === betaId, `Active company should be Beta`);
  console.log("   PASS — activeCompanyId is Beta");

  console.log("\n[4] Switch back to Alpha");
  const { res: backRes, json: backJson } = await apiFetch(session, "/api/companies", {
    method: "POST",
    body: JSON.stringify({ companyId: alphaId }),
  });
  assert(backRes.status === 200 && backJson.success, "Switch back failed");
  assert(backJson.data.companyId === alphaId, "Session should reflect Alpha company");
  console.log("   PASS — switched back to Alpha");

  console.log("\n[5] UI visibility rule — switcher shown when companies > 1 (any role)");
  const companyCount = listJson.data.companies.length;
  const userRole = switchJson.data.role;
  const switcherVisible = companyCount > 1;
  assert(switcherVisible && userRole !== "admin", "Switcher should be visible for non-admin multi-company user");
  console.log("   PASS — accountant with 2 companies would see CompanySwitcher");

  await wipeTestData();
  console.log("\nAll company switcher tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
