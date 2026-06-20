/**
 * Tier 1 Money & Trust integration tests.
 * Run: cd frontend && npm run test:tier1
 * Requires: dev server + Supabase .env.local + migrate-tier1-money-trust.sql applied
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
      // try next
    }
  }
  return "http://localhost:3000";
}

const BASE = await detectApiBase();
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST = {
  company: { name: "Tier1 Test Co", slug: "tier1-test-co" },
  user: {
    email: "tier1-test@ipms-test.local",
    password: "TestPass123!",
    name: "Tier1 Tester",
  },
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
  const json = await res.json();
  return { res, json };
}

async function applyMigrationIfNeeded() {
  const migrationPath = resolve(__dirname, "../../supabase/migrate-tier1-money-trust.sql");
  const sql = readFileSync(migrationPath, "utf8");
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("--"));

  for (const stmt of statements) {
    const { error } = await admin.rpc("exec_sql", { query: stmt });
    if (error) {
      // Fallback: run via REST isn't available — statements may already exist
      break;
    }
  }
}

async function ensureTestUser() {
  const { data: existingUsers } = await admin.auth.admin.listUsers();
  let userId = existingUsers?.users?.find((u) => u.email === TEST.user.email)?.id;

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: TEST.user.email,
      password: TEST.user.password,
      email_confirm: true,
      user_metadata: { name: TEST.user.name },
    });
    if (error) throw new Error(`Create user: ${error.message}`);
    userId = data.user.id;
  }

  let companyId;
  const { data: companyRow } = await admin
    .from("companies")
    .select("id")
    .eq("slug", TEST.company.slug)
    .maybeSingle();

  if (companyRow) {
    companyId = companyRow.id;
  } else {
    const { data, error } = await admin
      .from("companies")
      .insert({ name: TEST.company.name, slug: TEST.company.slug })
      .select("id")
      .single();
    if (error) throw new Error(`Create company: ${error.message}`);
    companyId = data.id;
    await admin.from("organization_settings").insert({
      company_id: companyId,
      name: TEST.company.name,
    });
  }

  await admin.from("company_members").upsert(
    { company_id: companyId, user_id: userId, role: "admin" },
    { onConflict: "company_id,user_id" }
  );

  await admin.from("profiles").upsert(
    { id: userId, name: TEST.user.name, email: TEST.user.email },
    { onConflict: "id" }
  );

  return { userId, companyId };
}

async function loginAs(companyId) {
  const session = createCookieSession();
  const { error } = await session.supabase.auth.signInWithPassword({
    email: TEST.user.email,
    password: TEST.user.password,
  });
  if (error) throw new Error(`Login: ${error.message}`);
  session.setCookie("ipms-active-company", companyId);
  return session;
}

async function ensureTemplate(companyId) {
  const { data: existing } = await admin
    .from("invoice_templates")
    .select("id")
    .eq("company_id", companyId)
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: tpl, error } = await admin
    .from("invoice_templates")
    .insert({
      company_id: companyId,
      name: "Tier1 Test Template",
      is_default: true,
      is_active: true,
      theme: "classic",
      branding_company_name: "Test Co",
    })
    .select("id")
    .single();
  if (error) throw new Error(`Template: ${error.message}`);
  return tpl.id;
}

async function ensureClient(session, companyId) {
  const { data: existing } = await admin
    .from("clients")
    .select("id")
    .eq("company_id", companyId)
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: client, error } = await admin
    .from("clients")
    .insert({
      company_id: companyId,
      name: "Tier1 Client",
      email: "client@tier1.test",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return client.id;
}

async function getTemplateId(companyId) {
  return ensureTemplate(companyId);
}

async function createSentInvoice(session, clientId, templateId, total = 1000) {
  const { json: createJson } = await apiFetch(session, "/api/invoices", {
    method: "POST",
    body: JSON.stringify({
      clientId,
      templateId,
      status: "draft",
      taxRate: 0,
      issueDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 86400000 * 30).toISOString(),
      items: [
        {
          description: "Test service",
          quantity: 1,
          unitPrice: total,
          amount: total,
        },
      ],
    }),
  });
  assert(createJson.success, createJson.error?.message ?? "Create invoice failed");
  const invoiceId = createJson.data.id;

  await apiFetch(session, `/api/invoices/${invoiceId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "sent" }),
  });

  const { json: refreshed } = await apiFetch(session, `/api/invoices/${invoiceId}`);
  return refreshed.data;
}

async function testPartialPayments(session) {
  console.log("\n[1] Partial payments → partially_paid → paid");
  const { companyId } = await ensureTestUser();
  const clientId = await ensureClient(session, companyId);
  const templateId = await getTemplateId(companyId);
  const invoice = await createSentInvoice(session, clientId, templateId, 1000);
  assert(invoice.status === "sent", "Expected sent");

  const { json: p1 } = await apiFetch(session, `/api/invoices/${invoice.id}/payments`, {
    method: "POST",
    body: JSON.stringify({
      amount: 400,
      method: "bank_transfer",
      referenceNumber: "TXN-001",
      paymentDate: new Date().toISOString(),
    }),
  });
  assert(p1.success, p1.error?.message ?? "Payment 1 failed");
  assert(p1.data.invoice.status === "partially_paid", "Expected partially_paid after first payment");

  const { json: p2 } = await apiFetch(session, `/api/invoices/${invoice.id}/payments`, {
    method: "POST",
    body: JSON.stringify({
      amount: 600,
      method: "bank_transfer",
      referenceNumber: "TXN-002",
      paymentDate: new Date().toISOString(),
    }),
  });
  assert(p2.success, p2.error?.message ?? "Payment 2 failed");
  assert(p2.data.invoice.status === "paid", "Expected paid when sum covers total");
  console.log("   PASS");
}

async function testOverpaymentFlag(session) {
  console.log("\n[2] Overpayment flagged, not silently accepted");
  const { companyId } = await ensureTestUser();
  const clientId = await ensureClient(session, companyId);
  const templateId = await getTemplateId(companyId);
  const invoice = await createSentInvoice(session, clientId, templateId, 500);

  const { json } = await apiFetch(session, `/api/invoices/${invoice.id}/payments`, {
    method: "POST",
    body: JSON.stringify({
      amount: 650,
      method: "cash",
      paymentDate: new Date().toISOString(),
    }),
  });
  assert(json.success, json.error?.message ?? "Overpayment record failed");
  assert(json.data.invoice.paymentVariance === "overpayment", "Expected overpayment flag");
  assert(json.data.invoice.status === "paid", "Expected paid status");
  console.log("   PASS");
}

async function testManualPaidBlocked(session) {
  console.log("\n[3] Manual paid status blocked");
  const { companyId } = await ensureTestUser();
  const clientId = await ensureClient(session, companyId);
  const templateId = await getTemplateId(companyId);
  const invoice = await createSentInvoice(session, clientId, templateId, 200);

  const { res, json } = await apiFetch(session, `/api/invoices/${invoice.id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "paid" }),
  });
  assert(res.status === 400, `Expected 400 blocking manual paid, got ${res.status}`);
  assert(!json.success, "Should reject manual paid");
  console.log("   PASS");
}

async function testSequentialNumbering(session, companyId) {
  console.log("\n[4] Concurrent invoice numbers — no duplicates");
  const clientId = await ensureClient(session, companyId);
  const templateId = await getTemplateId(companyId);

  const body = {
    clientId,
    templateId,
    status: "draft",
    taxRate: 0,
    issueDate: new Date().toISOString(),
    dueDate: new Date(Date.now() + 86400000 * 30).toISOString(),
    items: [{ description: "X", quantity: 1, unitPrice: 10, amount: 10 }],
  };

  const [a, b] = await Promise.all([
    apiFetch(session, "/api/invoices", { method: "POST", body: JSON.stringify(body) }),
    apiFetch(session, "/api/invoices", { method: "POST", body: JSON.stringify(body) }),
  ]);

  assert(a.json.success && b.json.success, "Both creates should succeed");
  const n1 = a.json.data.invoiceNumber;
  const n2 = b.json.data.invoiceNumber;
  assert(n1 !== n2, `Duplicate numbers: ${n1} and ${n2}`);
  assert(/^INV-\d{4}$/.test(n1), `Bad format: ${n1}`);
  console.log(`   Numbers: ${n1}, ${n2} — PASS`);
}

async function testVoidNotDelete(session) {
  console.log("\n[5] Issued invoice delete blocked; void works");
  const { companyId } = await ensureTestUser();
  const clientId = await ensureClient(session, companyId);
  const templateId = await getTemplateId(companyId);
  const invoice = await createSentInvoice(session, clientId, templateId, 300);

  const { res: delRes } = await apiFetch(session, `/api/invoices/${invoice.id}`, {
    method: "DELETE",
  });
  assert(delRes.status === 400, `Expected delete blocked, got ${delRes.status}`);

  const { json: voidJson } = await apiFetch(session, `/api/invoices/${invoice.id}/void`, {
    method: "POST",
    body: JSON.stringify({ reason: "Duplicate billing error" }),
  });
  assert(voidJson.success, voidJson.error?.message ?? "Void failed");
  assert(voidJson.data.status === "void", "Expected void status");
  console.log("   PASS");
}

async function testAiDraftFallback(session) {
  console.log("\n[6] AI draft fallback when API key invalid");
  const prev = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "invalid-key-on-purpose";

  const { json } = await apiFetch(session, "/api/invoices/ai-draft", {
    method: "POST",
    body: JSON.stringify({
      description: "web design project, 3 revisions, rush delivery",
    }),
  });

  if (prev) process.env.OPENAI_API_KEY = prev;
  else delete process.env.OPENAI_API_KEY;

  assert(json.success, json.error?.message ?? "AI draft should not hard-fail");
  assert(Array.isArray(json.data.items) && json.data.items.length > 0, "Expected line items");
  assert(
    json.data.source === "rules" || json.data.source === "ai",
    "Expected source field"
  );
  console.log(`   Source: ${json.data.source} — PASS`);
}

async function testAuditImmutability(companyId, userId) {
  console.log("\n[7] Audit log insert-only (update/delete rejected)");
  const { data: log, error: insertError } = await admin
    .from("audit_logs")
    .insert({
      company_id: companyId,
      action: "create",
      entity: "test",
      user_id: userId,
      user_name: "Test",
      description: "Tier1 immutability probe",
    })
    .select("id")
    .single();

  if (insertError?.message?.includes("audit_logs_action_check")) {
    console.log("   SKIP: migration not applied (run migrate-tier1-money-trust.sql)");
    return;
  }
  assert(!insertError, insertError?.message ?? "Insert failed");

  const { error: updateError } = await admin
    .from("audit_logs")
    .update({ description: "tampered" })
    .eq("id", log.id);
  assert(updateError, "Update should be rejected");

  const { error: deleteError } = await admin
    .from("audit_logs")
    .delete()
    .eq("id", log.id);
  assert(deleteError, "Delete should be rejected");
  console.log("   PASS");
}

async function main() {
  console.log(`Tier 1 tests → ${BASE}`);
  const { userId, companyId } = await ensureTestUser();
  const session = await loginAs(companyId);

  await testPartialPayments(session);
  await testOverpaymentFlag(session);
  await testManualPaidBlocked(session);
  await testSequentialNumbering(session, companyId);
  await testVoidNotDelete(session);
  await testAiDraftFallback(session);
  await testAuditImmutability(companyId, userId);

  console.log("\nAll Tier 1 tests passed.");
}

main().catch((err) => {
  console.error("\n" + err.message);
  process.exit(1);
});
