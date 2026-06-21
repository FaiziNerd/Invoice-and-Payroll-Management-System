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
import { fetchDashboardRawData } from "@/lib/analytics/fetch-dashboard-data";
import { generateRuleBasedPayrollInsights } from "@/lib/analytics/payroll-insights";
import { computeInvoiceAging } from "@/lib/invoices/aging";
import type { Invoice } from "@/types";

export async function GET() {
  const result = await requireCompanyContext({
    roles: ["admin", "accountant", "hr"],
  });
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  let raw;
  try {
    raw = await fetchDashboardRawData(supabase, companyId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load analytics";
    return fail("INTERNAL_ERROR", message, 500);
  }

  const { invoices, payrollRuns, employees, clients, departments, totalRevenue, totalPayroll, payrollMoM } = raw;

  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const overdueInvoices = invoices.filter((i) => i.status === "overdue");
  const sentInvoices = invoices.filter((i) => i.status === "sent");
  const outstanding = [...overdueInvoices, ...sentInvoices].reduce((s, i) => s + i.total, 0);

  const monthTotals = getMonthTotals(invoices, payrollRuns);
  const { current: currentMonth, previous: prevMonth } = getCurrentAndPreviousMonth(monthTotals);

  const revenueMoM = computeMoMChange(currentMonth?.revenue ?? 0, prevMonth?.revenue ?? 0);
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

  const payrollInsights = generateRuleBasedPayrollInsights(
    payrollRuns,
    employees,
    departments,
    totalRevenue,
    totalPayroll,
    payrollMoM
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
    payrollInsights,
    payrollInsightsSource: "rules" as const,
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
