/**
 * Seed a complete demo company for live presentations.
 *
 * Usage (from frontend/):
 *   npm run seed:demo
 *
 * Re-run anytime — wipes the demo company by slug and recreates all data.
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "crypto";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Demo identity (fixed so judges can log in after every re-seed)
// ---------------------------------------------------------------------------
export const DEMO = {
  company: {
    name: "Northstar Operations",
    slug: "northstar-operations",
    address: "425 Market Street, Suite 1200, San Francisco, CA 94105",
  },
  user: {
    email: "demo@ipms.app",
    password: "DemoIPMS2026!",
    name: "Alex Morgan",
  },
};

// ---------------------------------------------------------------------------
// Env + admin client
// ---------------------------------------------------------------------------
function loadEnv() {
  const envPath = resolve(__dirname, "../.env.local");
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
    throw new Error("Missing frontend/.env.local — copy .env.local.example and set Supabase keys.");
  }
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local");
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function shareToken() {
  return randomBytes(32).toString("hex");
}

function isoDaysFromNow(days) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

function isoMonthsAgo(months, day = 10) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  d.setDate(day);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

function allowance(name, amount) {
  return { id: randomUUID(), name, amount };
}

function deduction(name, amount) {
  return { id: randomUUID(), name, amount };
}

function calcTotals(items, taxRate) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxAmount = Math.round(subtotal * taxRate) / 100;
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
}

function brandingRow(companyName, overrides = {}) {
  return {
    branding_logo: null,
    branding_primary_color: overrides.primaryColor ?? "#1e3a5f",
    branding_secondary_color: overrides.secondaryColor ?? "#4a5568",
    branding_font_family: "Inter",
    branding_show_logo: overrides.showLogo ?? true,
    branding_show_notes: true,
    branding_show_payment_terms: true,
    branding_show_footer: true,
    branding_company_name: companyName,
    branding_company_address: overrides.address ?? DEMO.company.address,
    branding_payment_terms: "Payment due within 30 days of invoice date.",
    branding_footer_text: "Thank you for your business!",
  };
}

function log(step, detail = "") {
  console.log(detail ? `  ✓ ${step} — ${detail}` : `  ✓ ${step}`);
}

// ---------------------------------------------------------------------------
// Wipe + user bootstrap
// ---------------------------------------------------------------------------
async function wipeDemoCompany() {
  const { data: company } = await admin
    .from("companies")
    .select("id")
    .eq("slug", DEMO.company.slug)
    .maybeSingle();

  if (!company) return null;

  // payroll_entries.employee_id is ON DELETE RESTRICT — drop payroll before company cascade
  await admin.from("payroll_runs").delete().eq("company_id", company.id);

  const { error } = await admin.from("companies").delete().eq("id", company.id);
  if (error) throw new Error(`Wipe demo company: ${error.message}`);
  log("Wiped previous demo company", company.id);
  return company.id;
}

async function ensureDemoUser() {
  const { data: listed } = await admin.auth.admin.listUsers();
  let userId = listed?.users?.find((u) => u.email === DEMO.user.email)?.id;

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: DEMO.user.email,
      password: DEMO.user.password,
      email_confirm: true,
      user_metadata: { name: DEMO.user.name },
    });
    if (error) throw new Error(`Create demo user: ${error.message}`);
    userId = data.user.id;
    log("Created demo user", DEMO.user.email);
  } else {
    await admin.auth.admin.updateUserById(userId, {
      password: DEMO.user.password,
      user_metadata: { name: DEMO.user.name },
    });
    log("Reset demo user password", DEMO.user.email);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    await admin.from("profiles").insert({
      id: userId,
      name: DEMO.user.name,
      email: DEMO.user.email,
    });
  } else {
    await admin.from("profiles").update({ name: DEMO.user.name }).eq("id", userId);
  }

  return userId;
}

async function createCompany(userId) {
  const { data: company, error } = await admin
    .from("companies")
    .insert({ name: DEMO.company.name, slug: DEMO.company.slug })
    .select("id")
    .single();
  if (error) throw new Error(`Create company: ${error.message}`);

  const companyId = company.id;

  await admin.from("organization_settings").insert({
    company_id: companyId,
    name: DEMO.company.name,
    address: DEMO.company.address,
  });

  await admin.from("company_members").insert({
    company_id: companyId,
    user_id: userId,
    role: "admin",
  });

  log("Company", `${DEMO.company.name} (${companyId})`);
  return companyId;
}

// ---------------------------------------------------------------------------
// Templates + branding
// ---------------------------------------------------------------------------
async function seedTemplates(companyId) {
  const presets = [
    {
      name: "Classic",
      is_default: true,
      is_active: true,
      theme: "classic",
      ...brandingRow(DEMO.company.name, { primaryColor: "#1e3a5f" }),
    },
    {
      name: "Modern",
      is_default: false,
      is_active: true,
      theme: "modern",
      ...brandingRow(DEMO.company.name, { primaryColor: "#7c3aed", secondaryColor: "#a78bfa" }),
    },
    {
      name: "Minimal",
      is_default: false,
      is_active: true,
      theme: "minimal",
      ...brandingRow(DEMO.company.name, {
        primaryColor: "#18181b",
        secondaryColor: "#71717a",
        showLogo: false,
      }),
    },
  ];

  let defaultId = null;
  for (const preset of presets) {
    const { data, error } = await admin
      .from("invoice_templates")
      .insert({ company_id: companyId, ...preset })
      .select("id, is_default")
      .single();
    if (error) throw new Error(`Seed template ${preset.name}: ${error.message}`);
    if (data.is_default) defaultId = data.id;
  }

  await admin
    .from("organization_settings")
    .update({ default_template_id: defaultId })
    .eq("company_id", companyId);

  log("Invoice templates", "3 themes, Classic default");
  return defaultId;
}

// ---------------------------------------------------------------------------
// Departments & employees
// ---------------------------------------------------------------------------
async function seedDepartments(companyId) {
  const defs = [
    { name: "Engineering", description: "Product development and infrastructure" },
    { name: "Finance", description: "Accounting, payroll, and financial planning" },
    { name: "Operations", description: "HR, facilities, and customer support" },
  ];

  const ids = {};
  for (const def of defs) {
    const { data, error } = await admin
      .from("departments")
      .insert({ company_id: companyId, ...def })
      .select("id, name")
      .single();
    if (error) throw new Error(`Seed department ${def.name}: ${error.message}`);
    ids[def.name] = data.id;
  }

  log("Departments", `${defs.length} departments`);
  return ids;
}

async function seedEmployees(companyId, deptIds) {
  const roster = [
    { employee_id: "EMP-001", first_name: "Jordan", last_name: "Lee", email: "jordan.lee@northstar.internal", department: "Engineering", position: "Senior Software Engineer", salary_base: 9200, allowances: [["Remote stipend", 300]], deductions: [["401k", 460]] },
    { employee_id: "EMP-002", first_name: "Priya", last_name: "Sharma", email: "priya.sharma@northstar.internal", department: "Engineering", position: "Full-Stack Developer", salary_base: 7800, allowances: [["Remote stipend", 300]], deductions: [["401k", 390]] },
    { employee_id: "EMP-003", first_name: "Marcus", last_name: "Chen", email: "marcus.chen@northstar.internal", department: "Engineering", position: "QA Engineer", salary_base: 6500, allowances: [["Certification", 150]], deductions: [["401k", 325]] },
    { employee_id: "EMP-004", first_name: "Elena", last_name: "Vasquez", email: "elena.vasquez@northstar.internal", department: "Engineering", position: "DevOps Engineer", salary_base: 8400, allowances: [["On-call", 400]], deductions: [["401k", 420]] },
    { employee_id: "EMP-005", first_name: "David", last_name: "Okonkwo", email: "david.okonkwo@northstar.internal", department: "Finance", position: "Staff Accountant", salary_base: 6200, allowances: [["CPA bonus", 200]], deductions: [["Health", 180]] },
    { employee_id: "EMP-006", first_name: "Sarah", last_name: "Kim", email: "sarah.kim@northstar.internal", department: "Finance", position: "Payroll Specialist", salary_base: 5800, allowances: [["Transit", 120]], deductions: [["Health", 160]] },
    { employee_id: "EMP-007", first_name: "Rachel", last_name: "Brooks", email: "rachel.brooks@northstar.internal", department: "Operations", position: "HR Manager", salary_base: 7100, allowances: [["Leadership", 250]], deductions: [["401k", 355]] },
    { employee_id: "EMP-008", first_name: "Tom", last_name: "Nguyen", email: "tom.nguyen@northstar.internal", department: "Operations", position: "Office Manager", salary_base: 4800, allowances: [["Parking", 100]], deductions: [["Health", 140]] },
    { employee_id: "EMP-009", first_name: "Aisha", last_name: "Patel", email: "aisha.patel@northstar.internal", department: "Operations", position: "Support Lead", salary_base: 5400, allowances: [["Shift diff", 180]], deductions: [["401k", 270]] },
  ];

  const employees = [];
  const joinDate = isoMonthsAgo(14, 1);

  for (const row of roster) {
    const { data: emp, error } = await admin
      .from("employees")
      .insert({
        company_id: companyId,
        employee_id: row.employee_id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        phone: "+1-415-555-0100",
        department_id: deptIds[row.department],
        position: row.position,
        join_date: joinDate,
        status: "active",
        salary_base: row.salary_base,
      })
      .select("id, employee_id, first_name, last_name, salary_base")
      .single();
    if (error) throw new Error(`Seed employee ${row.employee_id}: ${error.message}`);

    const allowanceRows = row.allowances.map(([name, amount]) => ({
      employee_id: emp.id,
      name,
      amount,
    }));
    const deductionRows = row.deductions.map(([name, amount]) => ({
      employee_id: emp.id,
      name,
      amount,
    }));

    await admin.from("employee_allowances").insert(allowanceRows);
    await admin.from("employee_deductions").insert(deductionRows);

    const allowanceTotal = allowanceRows.reduce((s, a) => s + a.amount, 0);
    const deductionTotal = deductionRows.reduce((s, d) => s + d.amount, 0);

    employees.push({
      ...emp,
      allowances: allowanceRows.map((a) => allowance(a.name, a.amount)),
      deductions: deductionRows.map((d) => deduction(d.name, d.amount)),
      gross_pay: emp.salary_base + allowanceTotal,
      total_deductions: deductionTotal,
      net_pay: emp.salary_base + allowanceTotal - deductionTotal,
    });
  }

  log("Employees", `${employees.length} active with salary structures`);
  return employees;
}

// ---------------------------------------------------------------------------
// Clients & invoices
// ---------------------------------------------------------------------------
async function seedClients(companyId) {
  const clients = [
    { name: "Brightline Media", email: "ap@brightlinemedia.com", phone: "+1-212-555-0142", address: "88 Madison Ave, New York, NY 10016" },
    { name: "Summit Retail Group", email: "billing@summitretail.com", phone: "+1-312-555-0198", address: "200 Wacker Dr, Chicago, IL 60606" },
    { name: "Harbor Health Systems", email: "finance@harborhealth.org", phone: "+1-617-555-0167", address: "15 Harbor Way, Boston, MA 02210" },
    { name: "Greenfield Logistics", email: "accounts@greenfieldlog.com", phone: "+1-404-555-0133", address: "500 Peachtree St, Atlanta, GA 30308" },
    { name: "Nova Education Co", email: "payables@novaedu.io", phone: "+1-512-555-0174", address: "1200 Congress Ave, Austin, TX 78701" },
    { name: "Cascade Manufacturing", email: "ar@cascademfg.com", phone: "+1-503-555-0189", address: "901 Industrial Blvd, Portland, OR 97201" },
    { name: "Pinnacle Consulting", email: "invoices@pinnacleconsult.com", phone: "+1-206-555-0120", address: "400 Pine St, Seattle, WA 98101" },
  ];

  const rows = [];
  for (const c of clients) {
    const { data, error } = await admin
      .from("clients")
      .insert({ company_id: companyId, ...c })
      .select("id, name")
      .single();
    if (error) throw new Error(`Seed client ${c.name}: ${error.message}`);
    rows.push(data);
  }

  log("Clients", `${rows.length} clients`);
  return rows;
}

async function seedInvoices(companyId, templateId, clients) {
  const plans = [
    { num: "INV-2026-001", client: 0, status: "paid", issueMonthsAgo: 4, dueDaysAfterIssue: 30, taxRate: 10, items: [{ description: "Platform migration — phase 1", quantity: 1, unitPrice: 12000 }] },
    { num: "INV-2026-002", client: 1, status: "paid", issueMonthsAgo: 3, dueDaysAfterIssue: 30, taxRate: 10, items: [{ description: "E-commerce integration", quantity: 1, unitPrice: 8500 }] },
    { num: "INV-2026-003", client: 2, status: "paid", issueMonthsAgo: 2, dueDaysAfterIssue: 30, taxRate: 10, items: [{ description: "HIPAA compliance audit support", quantity: 1, unitPrice: 15000 }] },
    { num: "INV-2026-004", client: 3, status: "paid", issueMonthsAgo: 1, dueDaysAfterIssue: 30, taxRate: 10, items: [{ description: "Fleet tracking dashboard", quantity: 1, unitPrice: 6200 }] },
    { num: "INV-2026-005", client: 4, status: "paid", issueMonthsAgo: 0, dueDaysAfterIssue: 30, taxRate: 10, items: [{ description: "LMS content delivery setup", quantity: 1, unitPrice: 4800 }] },
    { num: "INV-2026-006", client: 5, status: "sent", issueDaysAgo: 10, dueDaysFromNow: 20, taxRate: 10, items: [{ description: "Production line monitoring MVP", quantity: 1, unitPrice: 9500 }] },
    { num: "INV-2026-007", client: 6, status: "sent", issueDaysAgo: 5, dueDaysFromNow: 25, taxRate: 10, items: [{ description: "Strategy workshop — Q2", quantity: 2, unitPrice: 3500 }] },
    { num: "INV-2026-008", client: 1, status: "overdue", issueDaysAgo: 50, dueDaysAgo: 18, taxRate: 10, items: [{ description: "POS system maintenance", quantity: 3, unitPrice: 1200 }] },
    { num: "INV-2026-009", client: 2, status: "overdue", issueDaysAgo: 80, dueDaysAgo: 45, taxRate: 10, items: [{ description: "Patient portal enhancements", quantity: 1, unitPrice: 7200 }] },
    { num: "INV-2026-010", client: 3, status: "draft", issueDaysAgo: 2, dueDaysFromNow: 28, taxRate: 10, items: [{ description: "Route optimization module", quantity: 1, unitPrice: 11000 }] },
    { num: "INV-2026-011", client: 0, status: "draft", issueDaysAgo: 1, dueDaysFromNow: 30, taxRate: 10, items: [{ description: "Analytics dashboard retainer", quantity: 1, unitPrice: 4500 }] },
  ];

  const invoiceIds = [];

  for (const plan of plans) {
    let issueDate;
    let dueDate;

    if (plan.issueMonthsAgo !== undefined) {
      issueDate = isoMonthsAgo(plan.issueMonthsAgo);
      dueDate = new Date(new Date(issueDate).getTime() + plan.dueDaysAfterIssue * 86400000).toISOString();
    } else if (plan.issueDaysAgo !== undefined) {
      issueDate = isoDaysAgo(plan.issueDaysAgo);
      if (plan.dueDaysAgo !== undefined) {
        dueDate = isoDaysAgo(plan.dueDaysAgo);
      } else {
        dueDate = isoDaysFromNow(plan.dueDaysFromNow);
      }
    }

    const { subtotal, taxAmount, total } = calcTotals(plan.items, plan.taxRate);

    const { data: invoice, error } = await admin
      .from("invoices")
      .insert({
        company_id: companyId,
        invoice_number: plan.num,
        client_id: clients[plan.client].id,
        template_id: templateId,
        share_token: shareToken(),
        issue_date: issueDate,
        due_date: dueDate,
        status: plan.status,
        subtotal,
        tax_rate: plan.taxRate,
        tax_amount: taxAmount,
        total,
        notes: plan.status === "draft" ? "Draft — pending internal review" : null,
      })
      .select("id, invoice_number, status")
      .single();
    if (error) throw new Error(`Seed invoice ${plan.num}: ${error.message}`);

    const itemRows = plan.items.map((item) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      amount: item.quantity * item.unitPrice,
    }));
    await admin.from("invoice_items").insert(itemRows);

    if (plan.status === "sent" || plan.status === "paid" || plan.status === "overdue") {
      await admin.from("invoice_history").insert({
        invoice_id: invoice.id,
        action: plan.status === "paid" ? "Marked as paid" : "Invoice sent",
        user_id: null,
        user_name: DEMO.user.name,
      });
    }

    invoiceIds.push(invoice);
  }

  const overdue = plans.filter((p) => p.status === "overdue").length;
  log("Invoices", `${plans.length} total (${overdue} overdue, 2 draft, 2 sent, 5 paid)`);
  return invoiceIds;
}

// ---------------------------------------------------------------------------
// Payroll + salary slips
// ---------------------------------------------------------------------------
async function seedPayroll(companyId, employees) {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const month = lastMonth.getMonth() + 1;
  const year = lastMonth.getFullYear();

  const totalGross = employees.reduce((s, e) => s + e.gross_pay, 0);
  const totalNet = employees.reduce((s, e) => s + e.net_pay, 0);
  const processedAt = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 28, 14, 0, 0).toISOString();

  const { data: run, error: runError } = await admin
    .from("payroll_runs")
    .insert({
      company_id: companyId,
      month,
      year,
      status: "paid",
      total_gross: totalGross,
      total_net: totalNet,
      processed_at: processedAt,
    })
    .select("id, month, year")
    .single();
  if (runError) throw new Error(`Seed payroll run: ${runError.message}`);

  const entries = employees.map((emp) => ({
    payroll_run_id: run.id,
    employee_id: emp.id,
    base_salary: emp.salary_base,
    bonus: month === 12 ? 500 : 0,
    one_off_deduction: 0,
    gross_pay: emp.gross_pay,
    total_deductions: emp.total_deductions,
    net_pay: emp.net_pay,
    allowances: emp.allowances,
    deductions: emp.deductions,
  }));

  await admin.from("payroll_entries").insert(entries);

  const slips = employees.map((emp) => ({
    company_id: companyId,
    payroll_run_id: run.id,
    employee_id: emp.id,
    month,
    year,
    base_salary: emp.salary_base,
    bonus: month === 12 ? 500 : 0,
    one_off_deduction: 0,
    gross_pay: emp.gross_pay,
    total_deductions: emp.total_deductions,
    net_pay: emp.net_pay,
    allowances: emp.allowances,
    deductions: emp.deductions,
    generated_at: processedAt,
  }));

  await admin.from("salary_slips").insert(slips);

  const monthName = lastMonth.toLocaleString("en-US", { month: "long" });
  log("Payroll", `${monthName} ${year} — paid, ${entries.length} entries, ${slips.length} salary slips`);
  return run;
}

// ---------------------------------------------------------------------------
// Audit logs (same shape as server-side recordAuditLog inserts)
// ---------------------------------------------------------------------------
async function seedAuditLogs(companyId, userId, clientId, invoiceId, payrollRunId) {
  const entries = [
    {
      company_id: companyId,
      user_id: userId,
      user_name: DEMO.user.name,
      action: "login",
      entity: "user",
      entity_id: userId,
      description: `${DEMO.user.name} logged in`,
      metadata: null,
      timestamp: isoDaysAgo(1),
    },
    {
      company_id: companyId,
      user_id: userId,
      user_name: DEMO.user.name,
      action: "create",
      entity: "client",
      entity_id: clientId,
      description: "Created client Brightline Media",
      metadata: null,
      timestamp: isoDaysAgo(30),
    },
    {
      company_id: companyId,
      user_id: userId,
      user_name: DEMO.user.name,
      action: "create",
      entity: "invoice",
      entity_id: invoiceId,
      description: "Created invoice INV-2026-001",
      metadata: null,
      timestamp: isoDaysAgo(28),
    },
    {
      company_id: companyId,
      user_id: userId,
      user_name: DEMO.user.name,
      action: "send",
      entity: "invoice",
      entity_id: invoiceId,
      description: "Sent invoice INV-2026-001 to Brightline Media",
      metadata: null,
      timestamp: isoDaysAgo(27),
    },
    {
      company_id: companyId,
      user_id: userId,
      user_name: DEMO.user.name,
      action: "process",
      entity: "payroll_run",
      entity_id: payrollRunId,
      description: `Processed payroll for ${new Date(new Date().getFullYear(), new Date().getMonth() - 1).toLocaleString("en-US", { month: "long", year: "numeric" })}`,
      metadata: null,
      timestamp: isoDaysAgo(3),
    },
    {
      company_id: companyId,
      user_id: userId,
      user_name: DEMO.user.name,
      action: "export",
      entity: "dashboard",
      entity_id: null,
      description: "Exported dashboard analytics CSV",
      metadata: null,
      timestamp: isoDaysAgo(2),
    },
  ];

  const { error } = await admin.from("audit_logs").insert(entries);
  if (error) throw new Error(`Seed audit logs: ${error.message}`);
  log("Audit logs", `${entries.length} entries`);
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------
async function verify(companyId) {
  const tables = [
    ["clients", "company_id"],
    ["invoices", "company_id"],
    ["employees", "company_id"],
    ["departments", "company_id"],
    ["payroll_runs", "company_id"],
    ["salary_slips", "company_id"],
    ["audit_logs", "company_id"],
    ["invoice_templates", "company_id"],
  ];

  console.log("\n--- Verification ---");
  for (const [table, col] of tables) {
    const { count, error } = await admin
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq(col, companyId);
    if (error) throw new Error(`Verify ${table}: ${error.message}`);
    console.log(`  ${table}: ${count}`);
  }

  const { count: overdueCount } = await admin
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("status", "overdue");

  const { count: itemCount } = await admin
    .from("invoice_items")
    .select("*, invoices!inner(company_id)", { count: "exact", head: true })
    .eq("invoices.company_id", companyId);

  console.log(`  invoice_items (via invoices): ${itemCount}`);
  console.log(`  overdue invoices: ${overdueCount}`);

  if (overdueCount < 2) {
    throw new Error(`Expected at least 2 overdue invoices, got ${overdueCount}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("IPMS demo seed\n");

  await wipeDemoCompany();
  const userId = await ensureDemoUser();
  const companyId = await createCompany(userId);
  const templateId = await seedTemplates(companyId);
  const deptIds = await seedDepartments(companyId);
  const employees = await seedEmployees(companyId, deptIds);
  const clients = await seedClients(companyId);
  const invoices = await seedInvoices(companyId, templateId, clients);
  const payrollRun = await seedPayroll(companyId, employees);

  await seedAuditLogs(
    companyId,
    userId,
    clients[0].id,
    invoices.find((i) => i.invoice_number === "INV-2026-001")?.id ?? invoices[0].id,
    payrollRun.id
  );

  await verify(companyId);

  console.log("\n--- Demo ready ---");
  console.log(`  Login:  ${DEMO.user.email}`);
  console.log(`  Password: ${DEMO.user.password}`);
  console.log(`  Company: ${DEMO.company.name} (slug: ${DEMO.company.slug})`);
  console.log("\n  After login, open /dashboard, /invoices, and /payroll to confirm populated data.");
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message ?? err);
  process.exit(1);
});
