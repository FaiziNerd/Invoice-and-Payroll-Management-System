import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import {
  computeDepartmentPayroll,
  computeMoMChange,
  generateDashboardInsights,
  getCurrentAndPreviousMonth,
  getMonthTotals,
  monthKey,
} from "@/lib/analytics/dashboard";
import { generatePayrollInsights } from "@/lib/analytics/payroll-insights";
import { computeInvoiceAging } from "@/lib/invoices/aging";
import { rowToInvoice, INVOICE_SELECT, type InvoiceItemRow, type InvoiceRow } from "@/lib/api/invoices/mappers";
import { rowToPayrollRun, type PayrollRunRow } from "@/lib/api/payroll/mappers";
import { rowToEmployee, type EmployeeRow } from "@/lib/api/employees/mappers";
import { rowToClient } from "@/lib/api/clients/mappers";
import type { Invoice } from "@/types";

const INVOICE_ANALYTICS_SELECT =
  INVOICE_SELECT + ", invoice_items(id, invoice_id, description, quantity, unit_price, amount)";

export async function GET() {
  const result = await requireCompanyContext({
    roles: ["admin", "accountant", "hr"],
  });
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  const [invoicesRes, payrollRes, employeesRes, clientsRes, departmentsRes] =
    await Promise.all([
    supabase
      .from("invoices")
      .select(INVOICE_ANALYTICS_SELECT)
      .eq("company_id", companyId),
    supabase
      .from("payroll_runs")
      .select(
        "id, company_id, month, year, status, total_gross, total_net, processed_at, created_at, payroll_entries(id, payroll_run_id, employee_id, base_salary, bonus, one_off_deduction, gross_pay, total_deductions, net_pay, allowances, deductions)"
      )
      .eq("company_id", companyId),
    supabase
      .from("employees")
      .select(
        "id, company_id, employee_id, first_name, last_name, email, phone, department_id, position, join_date, status, salary_base, created_at, employee_allowances(id, employee_id, name, amount), employee_deductions(id, employee_id, name, amount)"
      )
      .eq("company_id", companyId)
      .is("deleted_at", null),
    supabase
      .from("clients")
      .select("id, company_id, name, email, phone, address, created_at, deleted_at")
      .eq("company_id", companyId)
      .is("deleted_at", null),
    supabase.from("departments").select("id, name").eq("company_id", companyId),
  ]);

  if (invoicesRes.error) return fail("INTERNAL_ERROR", invoicesRes.error.message, 500);
  if (payrollRes.error) return fail("INTERNAL_ERROR", payrollRes.error.message, 500);
  if (employeesRes.error) return fail("INTERNAL_ERROR", employeesRes.error.message, 500);
  if (clientsRes.error) return fail("INTERNAL_ERROR", clientsRes.error.message, 500);
  if (departmentsRes.error) {
    return fail("INTERNAL_ERROR", departmentsRes.error.message, 500);
  }

  const invoices = ((invoicesRes.data ?? []) as unknown as Array<
    InvoiceRow & { invoice_items: InvoiceItemRow[] | null }
  >).map((row) => rowToInvoice(row, row.invoice_items ?? [], []));

  const payrollRuns = ((payrollRes.data ?? []) as PayrollRunRow[]).map(rowToPayrollRun);
  const employees = ((employeesRes.data ?? []) as EmployeeRow[]).map(rowToEmployee);
  const clients = (clientsRes.data ?? []).map(rowToClient);
  const departments = departmentsRes.data ?? [];

  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const overdueInvoices = invoices.filter((i) => i.status === "overdue");
  const sentInvoices = invoices.filter((i) => i.status === "sent");

  const totalRevenue = paidInvoices.reduce((s, i) => s + i.total, 0);
  const outstanding = [...overdueInvoices, ...sentInvoices].reduce((s, i) => s + i.total, 0);
  const totalPayroll = payrollRuns
    .filter((r) => r.status === "paid" || r.status === "processed")
    .reduce((s, r) => s + r.totalNet, 0);

  const monthTotals = getMonthTotals(invoices, payrollRuns);
  const { current: currentMonth, previous: prevMonth } = getCurrentAndPreviousMonth(monthTotals);

  const revenueMoM = computeMoMChange(currentMonth?.revenue ?? 0, prevMonth?.revenue ?? 0);
  const payrollMoM = computeMoMChange(currentMonth?.payroll ?? 0, prevMonth?.payroll ?? 0);
  const marginMoM = computeMoMChange(currentMonth?.margin ?? 0, prevMonth?.margin ?? 0);

  const outstandingMoM = computeMoMChange(
    [...overdueInvoices, ...sentInvoices]
      .filter((inv) => monthKey(inv.issueDate) === currentMonth?.key)
      .reduce((s, i) => s + i.total, 0),
    [...overdueInvoices, ...sentInvoices]
      .filter((inv) => monthKey(inv.issueDate) === prevMonth?.key)
      .reduce((s, i) => s + i.total, 0)
  );

  const reminderCandidates = invoices.filter((inv) => {
    if (inv.status !== "sent" && inv.status !== "overdue") return false;
    const due = new Date(inv.dueDate);
    const now = new Date();
    return due <= now || inv.status === "overdue";
  });

  const payrollInsightsResult = await generatePayrollInsights(
    payrollRuns,
    employees,
    departments,
    invoices,
    totalRevenue,
    totalPayroll
  );

  return ok({
    totalRevenue,
    outstanding,
    totalPayroll,
    netMargin: totalRevenue - totalPayroll,
    revenueMoM,
    outstandingMoM,
    payrollMoM,
    marginMoM,
    monthTotals,
    revenueByMonth: monthTotals.map((m) => ({ month: m.label, revenue: m.revenue })),
    netMarginTrend: monthTotals.map((m) => ({ month: m.label, margin: m.margin })),
    invoiceStatusData: [
      { name: "Paid", value: paidInvoices.length },
      { name: "Sent", value: sentInvoices.length },
      { name: "Overdue", value: overdueInvoices.length },
      { name: "Draft", value: invoices.filter((i) => i.status === "draft").length },
    ],
    agingData: computeInvoiceAging(invoices),
    payrollTrend: payrollRuns
      .slice(0, 6)
      .reverse()
      .map((r) => ({ month: `${r.month}/${r.year}`, expense: r.totalNet })),
    deptChartData: computeDepartmentPayroll(payrollRuns, employees, departments),
    insights: generateDashboardInsights(
      invoices,
      clients,
      revenueMoM,
      overdueInvoices.length,
      overdueInvoices.reduce((s, i) => s + i.total, 0)
    ),
    payrollInsights: payrollInsightsResult.insights,
    payrollInsightsSource: payrollInsightsResult.source,
    reminderCandidates: reminderCandidates.slice(0, 10).map((inv: Invoice) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientId: inv.clientId,
      total: inv.total,
      status: inv.status,
      dueDate: inv.dueDate,
    })),
    outstandingExportRows: [...overdueInvoices, ...sentInvoices].map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientId: inv.clientId,
      amount: inv.total,
      status: inv.status,
      dueDate: inv.dueDate,
    })),
  });
}
