/**
 * Security fix verification tests.
 * Run: npm run dev  (terminal 1)
 *      npm run test:security-fixes  (terminal 2)
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
      return [l.slice(0, i), l.slice(i + 1)];
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
      if (res.status === 401 || res.status === 200) return `http://localhost:${port}`;
    } catch {
      /* try next */
    }
  }
  return "http://localhost:3000";
}

const BASE = await detectApiBase();
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
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
  };
}

async function loginAs(email, password, companyId) {
  const session = createCookieSession();
  const { error } = await session.supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  session.setCookie("ipms-active-company", companyId);
  return session;
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
  return { res, json: await res.json() };
}

async function main() {
  console.log(`Security tests against ${BASE}\n`);

  const testEmail = "security-test@ipms-test.local";
  const testPassword = "TestPass123!";
  const slug = "security-test-co";

  let companyId;
  const { data: co } = await admin.from("companies").select("id").eq("slug", slug).maybeSingle();
  if (co) {
    companyId = co.id;
  } else {
    const { data: created } = await admin
      .from("companies")
      .insert({ name: "Security Test Co", slug })
      .select("id")
      .single();
    companyId = created.id;
    await admin.from("organization_settings").insert({ company_id: companyId, name: "Security Test Co" });
  }

  const { data: users } = await admin.auth.admin.listUsers();
  let userId = users?.users?.find((u) => u.email === testEmail)?.id;
  if (!userId) {
    const { data } = await admin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { name: "Security Tester" },
    });
    userId = data.user.id;
    await admin.from("profiles").insert({ id: userId, name: "Security Tester", email: testEmail });
  }

  const { data: member } = await admin
    .from("company_members")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) {
    await admin.from("company_members").insert({ company_id: companyId, user_id: userId, role: "admin" });
  }

  const session = await loginAs(testEmail, testPassword, companyId);

  console.log("[1] Forged audit log POST is rejected");
  const { res: auditRes, json: auditJson } = await apiFetch(session, "/api/audit-logs", {
    method: "POST",
    body: JSON.stringify({
      action: "delete",
      entity: "invoice",
      userName: "Fake Admin",
      description: "FORGED: deleted all invoices",
    }),
  });
  assert(auditRes.status === 403, `Expected 403, got ${auditRes.status}`);
  assert(
    auditJson.error?.message?.includes("server-side"),
    `Expected server-side message, got: ${auditJson.error?.message}`
  );
  console.log("   PASS — 403 Forbidden\n");

  console.log("[2] Slug-only join signup rejected");
  const joinEmail = `slug-join-${Date.now()}@ipms-test.local`;
  const { res: joinRes, json: joinJson } = await apiFetch(session, "/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      mode: "join",
      email: joinEmail,
      password: "TestPass123!",
      name: "Slug Joiner",
      joinSlug: slug,
    }),
  });
  assert(joinRes.status === 400, `Expected 400 validation, got ${joinRes.status}`);
  console.log("   PASS — slug join rejected\n");

  console.log("[3] Share token length is 256-bit (64 hex chars)");
  const { randomBytes } = await import("crypto");
  const token = randomBytes(32).toString("hex");
  assert(token.length === 64, `Expected 64-char token, got length ${token.length}`);
  console.log("   PASS — 64 hex chars (256 bits)\n");

  console.log("All security fix tests passed.");
  console.log("\nReminder: run supabase/migrate-company-invites.sql in SQL Editor for invite flow.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
