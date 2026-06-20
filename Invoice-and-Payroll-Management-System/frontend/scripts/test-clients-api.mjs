/**
 * Integration test for /api/clients — run with dev server on :3000
 * Usage: node scripts/test-clients-api.mjs
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
const BASE = process.env.API_BASE ?? "http://localhost:3001";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST = {
  companyA: { name: "Clients Test Co A", slug: "clients-test-a" },
  companyB: { name: "Clients Test Co B", slug: "clients-test-b" },
  userA: { email: "clients-test-a@ipms-test.local", password: "TestPass123!", name: "User A" },
  userB: { email: "clients-test-b@ipms-test.local", password: "TestPass123!", name: "User B" },
};

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

async function ensureTestUsers() {
  async function ensureUser(user, companySlug, companyName) {
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    let userId = existingUsers?.users?.find((u) => u.email === user.email)?.id;

    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { name: user.name },
      });
      if (error) throw new Error(`Create user ${user.email}: ${error.message}`);
      userId = data.user.id;
    }

    let companyId;
    const { data: companyRow } = await admin
      .from("companies")
      .select("id")
      .eq("slug", companySlug)
      .maybeSingle();

    if (companyRow) {
      companyId = companyRow.id;
    } else {
      const { data, error } = await admin
        .from("companies")
        .insert({ name: companyName, slug: companySlug })
        .select("id")
        .single();
      if (error) throw new Error(`Create company: ${error.message}`);
      companyId = data.id;
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
      });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      await admin.from("profiles").insert({
        id: userId,
        name: user.name,
        email: user.email,
      });
    }

    return { userId, companyId };
  }

  const a = await ensureUser(TEST.userA, TEST.companyA.slug, TEST.companyA.name);
  const b = await ensureUser(TEST.userB, TEST.companyB.slug, TEST.companyB.name);
  return { a, b };
}

async function loginAs(user, companyId) {
  const session = createCookieSession();
  const { error } = await session.supabase.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw new Error(`Login ${user.email}: ${error.message}`);
  session.setCookie("ipms-active-company", companyId);
  return session;
}

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

async function main() {
  console.log("Checking schema prerequisites...");
  const { error: companiesError } = await admin.from("companies").select("id").limit(1);
  if (companiesError) {
    console.error(
      "\nSchema not migrated: companies table missing.\n" +
        "Run supabase/migrate-multi-company.sql in Supabase SQL Editor first,\n" +
        "or set SUPABASE_DB_URL and run: node scripts/apply-migration.mjs\n"
    );
    process.exit(1);
  }

  console.log("Setting up test users...");
  const { a, b } = await ensureTestUsers();

  // Clean prior test clients for company A
  await admin.from("clients").delete().eq("company_id", a.companyId).like("email", "%@client-test.local");

  console.log("1. Login as Company A user...");
  const sessionA = await loginAs(TEST.userA, a.companyId);

  console.log("2. POST /api/clients — create...");
  const { res: createRes, json: createJson } = await apiFetch(sessionA, "/api/clients", {
    method: "POST",
    body: JSON.stringify({
      name: "Acme Corp",
      email: "acme@client-test.local",
      phone: "555-0100",
      address: "123 Main St",
    }),
  });
  assert(createRes.status === 201 && createJson.success, `Create failed: ${JSON.stringify(createJson)}`);
  const clientId = createJson.data.id;
  console.log("   Created client:", clientId);

  console.log("3. GET /api/clients — list...");
  const { json: listJson } = await apiFetch(sessionA, "/api/clients");
  assert(listJson.success && listJson.data.some((c) => c.id === clientId), "Client not in list");

  console.log("4. GET /api/clients/[id]...");
  const { json: getJson } = await apiFetch(sessionA, `/api/clients/${clientId}`);
  assert(getJson.success && getJson.data.name === "Acme Corp", "GET by id failed");

  console.log("5. PATCH /api/clients/[id] — update...");
  const { json: patchJson } = await apiFetch(sessionA, `/api/clients/${clientId}`, {
    method: "PATCH",
    body: JSON.stringify({ name: "Acme Updated", phone: "555-0199" }),
  });
  assert(patchJson.success && patchJson.data.name === "Acme Updated", "PATCH failed");

  console.log("6. Persistence — re-fetch list after refresh...");
  const sessionA2 = await loginAs(TEST.userA, a.companyId);
  const { json: refreshJson } = await apiFetch(sessionA2, "/api/clients");
  assert(
    refreshJson.data.find((c) => c.id === clientId)?.name === "Acme Updated",
    "Data not persisted after re-login"
  );

  console.log("7. DELETE blocked when client has invoices...");
  const { data: template } = await admin
    .from("invoice_templates")
    .select("id")
    .eq("company_id", a.companyId)
    .limit(1)
    .maybeSingle();

  let templateId = template?.id;
  if (!templateId) {
    const { data: t } = await admin
      .from("invoice_templates")
      .insert({
        company_id: a.companyId,
        name: "Test Template",
        is_default: true,
        is_active: true,
        theme: "classic",
        branding_primary_color: "#000",
        branding_secondary_color: "#fff",
        branding_font_family: "Inter",
        branding_company_name: "Test",
        branding_company_address: "Test",
        branding_payment_terms: "Net 30",
        branding_footer_text: "",
      })
      .select("id")
      .single();
    templateId = t.id;
  }

  await admin.from("invoices").insert({
    company_id: a.companyId,
    invoice_number: `TEST-${Date.now()}`,
    client_id: clientId,
    template_id: templateId,
    share_token: `test-token-${Date.now()}`,
    due_date: new Date(Date.now() + 86400000).toISOString(),
    status: "draft",
  });

  const { res: delBlockedRes, json: delBlockedJson } = await apiFetch(
    sessionA,
    `/api/clients/${clientId}`,
    { method: "DELETE" }
  );
  assert(delBlockedRes.status === 409, `Expected 409, got ${delBlockedRes.status}`);
  assert(
    delBlockedJson.error?.message?.includes("one or more invoices"),
    `Wrong error message: ${delBlockedJson.error?.message}`
  );
  console.log("   Delete correctly blocked");

  console.log("8. RLS — Company B user cannot see Company A clients...");
  const sessionB = await loginAs(TEST.userB, b.companyId);
  const { json: listB } = await apiFetch(sessionB, "/api/clients");
  assert(
    !listB.data.some((c) => c.id === clientId),
    "Company B user saw Company A client!"
  );

  const { res: crossGetRes } = await apiFetch(sessionB, `/api/clients/${clientId}`);
  assert(crossGetRes.status === 404, `Cross-company GET should 404, got ${crossGetRes.status}`);

  console.log("9. DELETE client without invoices...");
  await admin.from("invoices").delete().eq("client_id", clientId);
  const { res: delRes, json: delJson } = await apiFetch(sessionA, `/api/clients/${clientId}`, {
    method: "DELETE",
  });
  assert(delRes.status === 200 && delJson.success, `Delete failed: ${JSON.stringify(delJson)}`);

  const { json: listAfterDelete } = await apiFetch(sessionA, "/api/clients");
  assert(!listAfterDelete.data.some((c) => c.id === clientId), "Client still in list after delete");

  console.log("\nAll client API tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
