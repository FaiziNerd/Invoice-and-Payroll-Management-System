import {
  computeMoMChange,
  getCurrentAndPreviousMonth,
  getMonthTotals,
} from "@/lib/analytics/dashboard";
import { rowToInvoice, INVOICE_SELECT, type InvoiceRow } from "@/lib/api/invoices/mappers";
import { rowToPayrollRun, type PayrollRunRow } from "@/lib/api/payroll/mappers";
import { rowToEmployee, type EmployeeRow } from "@/lib/api/employees/mappers";
import { rowToClient, type ClientRow } from "@/lib/api/clients/mappers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Employee, Invoice, PayrollRun } from "@/types";

const EMPLOYEE_ANALYTICS_SELECT =
  "id, company_id, employee_id, first_name, last_name, email, phone, department_id, position, join_date, status, salary_base, created_at";

const PAYROLL_ANALYTICS_SELECT =
  "id, company_id, month, year, status, total_gross, total_net, processed_at, created_at, payroll_entries(id, employee_id, net_pay)";

const PAYROLL_HISTORY_MONTHS = 18;

export type DashboardRawData = {
  invoices: Invoice[];
  payrollRuns: PayrollRun[];
  employees: Employee[];
  clients: ReturnType<typeof rowToClient>[];
  departments: { id: string; name: string }[];
  totalRevenue: number;
  totalPayroll: number;
  payrollMoM: number | null;
};

export async function fetchDashboardRawData(
  supabase: SupabaseClient,
  companyId: string
): Promise<DashboardRawData> {
  const [invoicesRes, payrollRes, employeesRes, clientsRes, departmentsRes] =
    await Promise.all([
      supabase.from("invoices").select(INVOICE_SELECT).eq("company_id", companyId),
      supabase
        .from("payroll_runs")
        .select(PAYROLL_ANALYTICS_SELECT)
        .eq("company_id", companyId)
        .in("status", ["paid", "processed"])
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .limit(PAYROLL_HISTORY_MONTHS),
      supabase
        .from("employees")
        .select(EMPLOYEE_ANALYTICS_SELECT)
        .eq("company_id", companyId)
        .is("deleted_at", null),
      supabase
        .from("clients")
        .select("id, company_id, name, email, phone, address, created_at, deleted_at")
        .eq("company_id", companyId)
        .is("deleted_at", null),
      supabase.from("departments").select("id, name").eq("company_id", companyId),
    ]);

  if (invoicesRes.error) throw new Error(invoicesRes.error.message);
  if (payrollRes.error) throw new Error(payrollRes.error.message);
  if (employeesRes.error) throw new Error(employeesRes.error.message);
  if (clientsRes.error) throw new Error(clientsRes.error.message);
  if (departmentsRes.error) throw new Error(departmentsRes.error.message);

  const invoices = ((invoicesRes.data ?? []) as InvoiceRow[]).map((row) =>
    rowToInvoice(row, [], [])
  );

  const payrollRuns = ((payrollRes.data ?? []) as PayrollRunRow[]).map(rowToPayrollRun);
  const employees = ((employeesRes.data ?? []) as EmployeeRow[]).map((row) =>
    rowToEmployee({ ...row, employee_allowances: [], employee_deductions: [] })
  );
  const clients = (clientsRes.data ?? []).map((row) => rowToClient(row as ClientRow));
  const departments = departmentsRes.data ?? [];

  const totalRevenue = invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.total, 0);
  const totalPayroll = payrollRuns.reduce((s, r) => s + r.totalNet, 0);

  const monthTotals = getMonthTotals(invoices, payrollRuns);
  const { current, previous } = getCurrentAndPreviousMonth(monthTotals);
  const payrollMoM = computeMoMChange(current?.payroll ?? 0, previous?.payroll ?? 0);

  return {
    invoices,
    payrollRuns,
    employees,
    clients,
    departments,
    totalRevenue,
    totalPayroll,
    payrollMoM,
  };
}
