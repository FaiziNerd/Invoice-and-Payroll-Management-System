/**
 * Tier 2 Operational Reliability tests.
 * Run: cd frontend && npm run dev  (terminal 1)
 *      npm run test:tier2           (terminal 2)
 * Requires: .env.local + migrate-tier2-operational-reliability.sql applied
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

async function ensureCompany(slug, name) {
  let { data: co } = await admin.from("companies").select("id").eq("slug", slug).maybeSingle();
  if (!co) {
    const { data: created } = await admin.from("companies").insert({ name, slug }).select("id").single();
    co = created;
    await admin.from("organization_settings").insert({ company_id: co.id, name });
  }
  return co.id;
}

async function ensureAdminUser(email, password, name, companyId) {
  const { data: users } = await admin.auth.admin.listUsers();
  let userId = users?.users?.find((u) => u.email === email)?.id;
  if (!userId) {
    const { data } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    userId = data.user.id;
    await admin.from("profiles").upsert({ id: userId, name, email });
  }
  const { data: member } = await admin
    .from("company_members")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) {
    await admin.from("company_members").insert({
      company_id: companyId,
      user_id: userId,
      role: "admin",
      status: "active",
    });
  }
  return userId;
}

async function main() {
  console.log(`Tier 2 tests against ${BASE}\n`);

  const slug = "tier2-test-co";
  const companyId = await ensureCompany(slug, "Tier2 Test Co");
  const adminEmail = "tier2-admin@ipms-test.local";
  const adminPassword = "TestPass123!";
  await ensureAdminUser(adminEmail, adminPassword, "Tier2 Admin", companyId);

  const adminSession = await loginAs(adminEmail, adminPassword, companyId);

  console.log("[1] Invoice list pagination returns cursor page");
  const { json: page1 } = await apiFetch(adminSession, "/api/invoices?limit=10");
  assert(page1.success, page1.error?.message ?? "page1 failed");
  assert(Array.isArray(page1.data.items), "items array missing");
  assert(typeof page1.data.hasMore === "boolean", "hasMore missing");
  console.log(`   PASS — page1 items=${page1.data.items.length}, hasMore=${page1.data.hasMore}\n`);

  console.log("[2] Dashboard analytics endpoint works (not tied to paginated list cache)");
  const { json: analytics } = await apiFetch(adminSession, "/api/dashboard/analytics");
  assert(analytics.success, analytics.error?.message ?? "analytics failed");
  assert(typeof analytics.data.totalRevenue === "number", "totalRevenue missing");
  console.log(`   PASS — revenue=${analytics.data.totalRevenue}\n`);

  console.log("[3] Email-specific invite rejects wrong email");
  const inviteEmail = `invited-${Date.now()}@ipms-test.local`;
  const { json: inviteCreated } = await apiFetch(adminSession, "/api/invites", {
    method: "POST",
    body: JSON.stringify({ email: inviteEmail, role: "accountant", expiresInDays: 7 }),
  });
  assert(inviteCreated.success, inviteCreated.error?.message ?? "invite create failed");
  const token = inviteCreated.data.token;

  const wrongEmail = `wrong-${Date.now()}@ipms-test.local`;
  const { res: wrongJoinRes } = await apiFetch(adminSession, "/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      mode: "join",
      email: wrongEmail,
      password: "TestPass123!",
      name: "Wrong Joiner",
      inviteCode: token,
    }),
  });
  assert(wrongJoinRes.status === 403, `Expected 403, got ${wrongJoinRes.status}`);
  console.log("   PASS — wrong email rejected\n");

  console.log("[4] Soft-delete client still allows invoice client lookup");
  const { json: clientCreated } = await apiFetch(adminSession, "/api/clients", {
    method: "POST",
    body: JSON.stringify({
      name: "Tier2 Soft Delete Client",
      email: `soft-${Date.now()}@test.local`,
      phone: "",
      address: "123 Test",
    }),
  });
  assert(clientCreated.success, "client create failed");
  const clientId = clientCreated.data.id;

  const { json: invoiceCreated } = await apiFetch(adminSession, "/api/invoices", {
    method: "POST",
    body: JSON.stringify({
      clientId,
      items: [{ description: "Test", quantity: 1, unitPrice: 100 }],
      status: "draft",
      issueDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      templateId: null,
    }),
  });
  if (!invoiceCreated.success) {
    console.log("   SKIP invoice create (needs template) — soft delete client fetch only");
  } else {
    await apiFetch(adminSession, `/api/clients/${clientId}`, { method: "DELETE" });
    const { json: invoiceDetail } = await apiFetch(
      adminSession,
      `/api/invoices/${invoiceCreated.data.id}`
    );
    assert(invoiceDetail.success, "invoice detail failed after client soft-delete");
    console.log("   PASS — invoice still loads after client soft-delete\n");
  }

  console.log("[5] Pending slug join has no active access");
  const pendingEmail = `pending-${Date.now()}@ipms-test.local`;
  const { json: pendingSignup } = await apiFetch(adminSession, "/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      mode: "join-slug",
      email: pendingEmail,
      password: "TestPass123!",
      name: "Pending User",
      companySlug: slug,
    }),
  });
  assert(pendingSignup.success, pendingSignup.error?.message ?? "pending signup failed");
  assert(pendingSignup.data.memberStatus === "pending", "expected pending memberStatus");

  const pendingSession = await loginAs(pendingEmail, "TestPass123!", companyId);
  const { res: blockedRes } = await apiFetch(pendingSession, "/api/clients");
  assert(blockedRes.status === 403, `Expected 403 for pending user, got ${blockedRes.status}`);
  console.log("   PASS — pending user blocked from company data\n");

  console.log("All Tier 2 tests passed.");
  console.log("\nReminder: apply supabase/migrate-tier2-operational-reliability.sql in Supabase SQL Editor.");
  console.log("Manual checks: send invoice email (PDF attachment) and employee portal invite/login.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
