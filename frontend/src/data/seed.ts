import { getFromStorage, setInStorage, setCurrentCompanyId } from "@/lib/mock-db/storage";
import { DEMO_USERS } from "@/lib/mock-db/auth";
import { seedTemplates } from "@/lib/mock-db/templates";
import { seedCompanies, SEED_COMPANIES } from "@/lib/mock-db/companies";
import { generateId } from "@/lib/utils";
import type {
  Client,
  Department,
  Employee,
  Invoice,
  OrganizationSettings,
  PayrollEntry,
  PayrollRun,
  SalarySlip,
} from "@/types";

const SEEDED_KEY = "seeded_v2";

function buildPayrollEntry(employee: Employee, overrides?: { bonus?: number; oneOffDeduction?: number }): PayrollEntry {
  const { baseSalary, allowances, deductions } = employee.salaryStructure;
  const allowanceTotal = allowances.reduce((s, a) => s + a.amount, 0);
  const deductionTotal = deductions.reduce((s, d) => s + d.amount, 0);
  const bonus = overrides?.bonus ?? 0;
  const oneOffDeduction = overrides?.oneOffDeduction ?? 0;
  const grossPay = baseSalary + allowanceTotal + bonus;
  const totalDeductions = deductionTotal + oneOffDeduction;
  const netPay = grossPay - totalDeductions;
  return {
    id: generateId(),
    employeeId: employee.id,
    baseSalary,
    allowances,
    deductions,
    bonus,
    oneOffDeduction,
    grossPay,
    totalDeductions,
    netPay,
  };
}

function monthYearOffset(base: Date, offsetMonths: number): { month: number; year: number } {
  const d = new Date(base.getFullYear(), base.getMonth() - offsetMonths, 1);
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

function buildPayrollRun(
  employees: Employee[],
  month: number,
  year: number,
  status: PayrollRun["status"],
  createdAt: string,
  processedAt?: string
): PayrollRun {
  const entries = employees.map((emp, i) =>
    buildPayrollEntry(emp, i === 0 && status !== "draft" ? { bonus: 500 } : undefined)
  );
  const totalGross = entries.reduce((s, e) => s + e.grossPay, 0);
  const totalNet = entries.reduce((s, e) => s + e.netPay, 0);
  return {
    id: generateId(),
    month,
    year,
    status,
    entries,
    totalGross,
    totalNet,
    processedAt,
    createdAt,
  };
}

function buildSalarySlips(run: PayrollRun, generatedAt: string): SalarySlip[] {
  return run.entries.map((entry) => ({
    id: generateId(),
    payrollRunId: run.id,
    employeeId: entry.employeeId,
    month: run.month,
    year: run.year,
    baseSalary: entry.baseSalary,
    allowances: entry.allowances,
    deductions: entry.deductions,
    bonus: entry.bonus,
    oneOffDeduction: entry.oneOffDeduction,
    grossPay: entry.grossPay,
    totalDeductions: entry.totalDeductions,
    netPay: entry.netPay,
    generatedAt,
  }));
}

interface CompanySeedConfig {
  settings: OrganizationSettings;
  departments: Omit<Department, "id" | "createdAt">[];
  clients: Omit<Client, "id" | "createdAt">[];
  employees: (deptIndex: number) => Omit<Employee, "id" | "createdAt" | "departmentId">[];
  invoices: (clientIds: string[], defaultTemplateId: string, now: Date) => Omit<
    Invoice,
    "id" | "shareToken" | "history" | "createdAt" | "updatedAt"
  >[];
  payrollOffsets: { offset: number; status: PayrollRun["status"]; processedDaysAgo?: number }[];
}

function seedCompanyData(companyId: string, config: CompanySeedConfig): void {
  seedTemplates(companyId);

  const templates = getFromStorage<{ id: string; isDefault: boolean }[]>("templates", [], companyId);
  const defaultTemplate = templates.find((t) => t.isDefault) || templates[0];

  const departments: Department[] = config.departments.map((d) => ({
    ...d,
    id: generateId(),
    createdAt: new Date().toISOString(),
  }));
  setInStorage("departments", departments, companyId);

  const clients: Client[] = config.clients.map((c) => ({
    ...c,
    id: generateId(),
    createdAt: new Date().toISOString(),
  }));
  setInStorage("clients", clients, companyId);

  const employees: Employee[] = config.employees(departments.length).map((emp, i) => ({
    ...emp,
    id: generateId(),
    departmentId: departments[i % departments.length].id,
    createdAt: new Date().toISOString(),
  }));
  setInStorage("employees", employees, companyId);

  const now = new Date();
  const clientIds = clients.map((c) => c.id);
  const invoiceDrafts = config.invoices(clientIds, defaultTemplate?.id || "", now);
  const invoices: Invoice[] = invoiceDrafts.map((draft) => ({
    ...draft,
    id: generateId(),
    shareToken: generateId().replace(/-/g, "").slice(0, 16),
    history: [
      {
        id: generateId(),
        action: "Invoice created",
        timestamp: new Date().toISOString(),
      },
      ...(draft.status !== "draft"
        ? [
            {
              id: generateId(),
              action: `Status changed to ${draft.status}`,
              timestamp: new Date().toISOString(),
            },
          ]
        : []),
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  setInStorage("invoices", invoices, companyId);

  setInStorage(
    "settings",
    { ...config.settings, defaultTemplateId: defaultTemplate?.id || "" },
    companyId
  );

  const payrollRuns: PayrollRun[] = config.payrollOffsets.map(({ offset, status, processedDaysAgo = 30 + offset * 10 }) => {
    const { month, year } = monthYearOffset(now, offset);
    const createdAt = new Date(now.getFullYear(), now.getMonth() - offset, 5).toISOString();
    const processedAt =
      status !== "draft"
        ? new Date(Date.now() - processedDaysAgo * 24 * 60 * 60 * 1000).toISOString()
        : undefined;
    return buildPayrollRun(employees, month, year, status, createdAt, processedAt);
  });
  setInStorage("payroll_runs", payrollRuns, companyId);

  const salarySlips: SalarySlip[] = payrollRuns.flatMap((run) => {
    const generatedAt = run.processedAt ?? run.createdAt;
    return buildSalarySlips(run, generatedAt);
  });
  setInStorage("salary_slips", salarySlips, companyId);
}

export function initializeSeedData(): void {
  if (typeof window === "undefined") return;
  if (getFromStorage<boolean>(SEEDED_KEY, false)) return;

  setInStorage("users", DEMO_USERS);
  seedCompanies();
  setCurrentCompanyId(SEED_COMPANIES[0].id);

  seedCompanyData("company-dotcode", {
    settings: {
      id: "org-dotcode",
      name: "DotCode Solutions",
      address: "123 Business Ave, Suite 100, New York, NY 10001",
      defaultTemplateId: "",
    },
    departments: [
      { name: "Engineering", description: "Software development and IT" },
      { name: "Finance", description: "Accounting and financial operations" },
      { name: "Human Resources", description: "People operations and recruitment" },
    ],
    clients: [
      {
        name: "Acme Corporation",
        email: "billing@acme.com",
        phone: "+1 555-0101",
        address: "456 Commerce St, Chicago, IL 60601",
      },
      {
        name: "TechStart Inc",
        email: "accounts@techstart.io",
        phone: "+1 555-0102",
        address: "789 Innovation Blvd, Austin, TX 78701",
      },
      {
        name: "Global Services Ltd",
        email: "finance@globalservices.com",
        phone: "+1 555-0103",
        address: "321 Enterprise Way, Seattle, WA 98101",
      },
    ],
    employees: () => [
      {
        employeeId: "EMP-001",
        firstName: "John",
        lastName: "Developer",
        email: "john@dotcode.com",
        phone: "+1 555-0201",
        position: "Senior Developer",
        joinDate: "2023-01-15",
        status: "active",
        salaryStructure: {
          baseSalary: 8500,
          allowances: [
            { id: generateId(), name: "HRA", amount: 1200 },
            { id: generateId(), name: "Transport", amount: 300 },
          ],
          deductions: [
            { id: generateId(), name: "Tax", amount: 1500 },
            { id: generateId(), name: "Insurance", amount: 200 },
          ],
        },
      },
      {
        employeeId: "EMP-002",
        firstName: "Emily",
        lastName: "Analyst",
        email: "emily@dotcode.com",
        phone: "+1 555-0202",
        position: "Financial Analyst",
        joinDate: "2023-06-01",
        status: "active",
        salaryStructure: {
          baseSalary: 7200,
          allowances: [
            { id: generateId(), name: "HRA", amount: 1000 },
            { id: generateId(), name: "Transport", amount: 250 },
          ],
          deductions: [
            { id: generateId(), name: "Tax", amount: 1200 },
            { id: generateId(), name: "Insurance", amount: 180 },
          ],
        },
      },
      {
        employeeId: "EMP-003",
        firstName: "Michael",
        lastName: "Manager",
        email: "michael@dotcode.com",
        phone: "+1 555-0203",
        position: "HR Manager",
        joinDate: "2022-03-10",
        status: "active",
        salaryStructure: {
          baseSalary: 7800,
          allowances: [
            { id: generateId(), name: "HRA", amount: 1100 },
            { id: generateId(), name: "Transport", amount: 280 },
          ],
          deductions: [
            { id: generateId(), name: "Tax", amount: 1350 },
            { id: generateId(), name: "Insurance", amount: 190 },
          ],
        },
      },
    ],
    invoices: (clientIds, templateId, now) => [
      {
        invoiceNumber: "INV-0001",
        clientId: clientIds[0],
        items: [
          { id: generateId(), description: "Web Development Services", quantity: 40, unitPrice: 150, amount: 6000 },
          { id: generateId(), description: "UI/UX Design", quantity: 20, unitPrice: 120, amount: 2400 },
        ],
        subtotal: 8400,
        taxRate: 10,
        taxAmount: 840,
        total: 9240,
        status: "paid",
        templateId,
        issueDate: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString(),
        dueDate: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
        notes: "Thank you for your continued partnership.",
      },
      {
        invoiceNumber: "INV-0002",
        clientId: clientIds[1],
        items: [
          { id: generateId(), description: "Consulting Services", quantity: 30, unitPrice: 200, amount: 6000 },
        ],
        subtotal: 6000,
        taxRate: 10,
        taxAmount: 600,
        total: 6600,
        status: "sent",
        templateId,
        issueDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        dueDate: new Date(now.getFullYear(), now.getMonth(), 28).toISOString(),
      },
      {
        invoiceNumber: "INV-0003",
        clientId: clientIds[2],
        items: [
          { id: generateId(), description: "Annual Maintenance", quantity: 1, unitPrice: 12000, amount: 12000 },
        ],
        subtotal: 12000,
        taxRate: 10,
        taxAmount: 1200,
        total: 13200,
        status: "overdue",
        templateId,
        issueDate: new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString(),
        dueDate: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString(),
      },
    ],
    payrollOffsets: [
      { offset: 3, status: "paid", processedDaysAgo: 85 },
      { offset: 2, status: "paid", processedDaysAgo: 55 },
      { offset: 1, status: "processed", processedDaysAgo: 25 },
    ],
  });

  seedCompanyData("company-acme", {
    settings: {
      id: "org-acme",
      name: "Acme Holdings",
      address: "500 Industrial Park Dr, Denver, CO 80202",
      defaultTemplateId: "",
    },
    departments: [
      { name: "Sales", description: "Revenue and client acquisition" },
      { name: "Operations", description: "Logistics and fulfillment" },
    ],
    clients: [
      {
        name: "Summit Retail Group",
        email: "ap@summitretail.com",
        phone: "+1 555-0301",
        address: "88 Market Plaza, Denver, CO 80203",
      },
      {
        name: "Pioneer Logistics",
        email: "billing@pioneerlogistics.com",
        phone: "+1 555-0302",
        address: "210 Freight Lane, Phoenix, AZ 85001",
      },
    ],
    employees: () => [
      {
        employeeId: "ACM-001",
        firstName: "Sarah",
        lastName: "Reynolds",
        email: "sarah@acmeholdings.com",
        phone: "+1 555-0401",
        position: "Sales Director",
        joinDate: "2021-08-20",
        status: "active",
        salaryStructure: {
          baseSalary: 9200,
          allowances: [
            { id: generateId(), name: "Commission", amount: 800 },
            { id: generateId(), name: "Travel", amount: 400 },
          ],
          deductions: [
            { id: generateId(), name: "Tax", amount: 1700 },
            { id: generateId(), name: "401k", amount: 350 },
          ],
        },
      },
      {
        employeeId: "ACM-002",
        firstName: "David",
        lastName: "Chen",
        email: "david@acmeholdings.com",
        phone: "+1 555-0402",
        position: "Operations Lead",
        joinDate: "2022-11-05",
        status: "active",
        salaryStructure: {
          baseSalary: 6800,
          allowances: [
            { id: generateId(), name: "Shift Allowance", amount: 500 },
          ],
          deductions: [
            { id: generateId(), name: "Tax", amount: 1100 },
            { id: generateId(), name: "Insurance", amount: 150 },
          ],
        },
      },
    ],
    invoices: (clientIds, templateId, now) => [
      {
        invoiceNumber: "ACM-0001",
        clientId: clientIds[0],
        items: [
          { id: generateId(), description: "Distribution Services Q1", quantity: 1, unitPrice: 18500, amount: 18500 },
        ],
        subtotal: 18500,
        taxRate: 8,
        taxAmount: 1480,
        total: 19980,
        status: "paid",
        templateId,
        issueDate: new Date(now.getFullYear(), now.getMonth() - 1, 10).toISOString(),
        dueDate: new Date(now.getFullYear(), now.getMonth(), 10).toISOString(),
      },
      {
        invoiceNumber: "ACM-0002",
        clientId: clientIds[1],
        items: [
          { id: generateId(), description: "Warehouse Management", quantity: 3, unitPrice: 4500, amount: 13500 },
        ],
        subtotal: 13500,
        taxRate: 8,
        taxAmount: 1080,
        total: 14580,
        status: "sent",
        templateId,
        issueDate: new Date(now.getFullYear(), now.getMonth(), 5).toISOString(),
        dueDate: new Date(now.getFullYear(), now.getMonth() + 1, 5).toISOString(),
      },
    ],
    payrollOffsets: [
      { offset: 2, status: "paid", processedDaysAgo: 60 },
      { offset: 1, status: "processed", processedDaysAgo: 28 },
    ],
  });

  setInStorage(SEEDED_KEY, true);
}
