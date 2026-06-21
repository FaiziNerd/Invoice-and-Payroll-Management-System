import type { Employee, Invoice, PayrollRun } from "@/types";
import {
  computeDepartmentPayroll,
  computeMoMChange,
  getCurrentAndPreviousMonth,
  getMonthTotals,
} from "@/lib/analytics/dashboard";
import { callLlmForPayrollInsights } from "@/lib/server/llm-chat";
import type { DashboardRawData } from "@/lib/analytics/fetch-dashboard-data";

export interface PayrollInsight {
  id: string;
  text: string;
  type: "warning" | "info" | "success";
}

export interface PayrollInsightsResult {
  insights: PayrollInsight[];
  source: "ai" | "rules";
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Rule-based payroll highlights — always available without an LLM. */
export function generateRuleBasedPayrollInsights(
  payrollRuns: PayrollRun[],
  employees: Employee[],
  departments: { id: string; name: string }[],
  totalRevenue: number,
  totalPayroll: number,
  payrollMoM: number | null
): PayrollInsight[] {
  const insights: PayrollInsight[] = [];

  if (payrollMoM !== null && Math.abs(payrollMoM) >= 10) {
    const direction = payrollMoM >= 0 ? "increased" : "decreased";
    insights.push({
      id: "payroll-mom",
      text: `Payroll ${direction} ${Math.abs(payrollMoM).toFixed(1)}% month-over-month — review headcount and bonus adjustments.`,
      type: payrollMoM >= 15 ? "warning" : "info",
    });
  }

  const deptData = computeDepartmentPayroll(payrollRuns, employees, departments);
  if (deptData.length > 0 && totalPayroll > 0) {
    const topDept = deptData.reduce((max, d) => (d.value > max.value ? d : max), deptData[0]);
    const pct = (topDept.value / totalPayroll) * 100;
    if (pct >= 30) {
      insights.push({
        id: "dept-concentration",
        text: `${topDept.name} accounts for ${pct.toFixed(0)}% of payroll (${formatCurrency(topDept.value)}) — highest department cost.`,
        type: pct >= 50 ? "warning" : "info",
      });
    }
  }

  if (totalRevenue > 0 && totalPayroll > 0) {
    const margin = totalRevenue - totalPayroll;
    const marginPct = (margin / totalRevenue) * 100;
    if (marginPct < 20) {
      insights.push({
        id: "margin-pressure",
        text: `Net margin is ${marginPct.toFixed(1)}% (${formatCurrency(margin)}) — payroll consumes ${((totalPayroll / totalRevenue) * 100).toFixed(0)}% of revenue.`,
        type: marginPct < 10 ? "warning" : "info",
      });
    }
  }

  const activeEmployees = employees.filter((e) => e.status === "active");
  const processedRuns = payrollRuns.filter(
    (r) => r.status === "paid" || r.status === "processed"
  );
  if (activeEmployees.length > 0 && processedRuns.length > 0) {
    const avgNet =
      totalPayroll / Math.max(processedRuns.length, 1) / Math.max(activeEmployees.length, 1);
    insights.push({
      id: "avg-cost",
      text: `${activeEmployees.length} active employees — average net pay per person per run is about ${formatCurrency(avgNet)}.`,
      type: "info",
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "payroll-healthy",
      text: "Payroll metrics look stable. No urgent cost anomalies detected this month.",
      type: "success",
    });
  }

  return insights.slice(0, 4);
}

export function buildPayrollInsightsSummary(raw: DashboardRawData) {
  const monthTotals = getMonthTotals(raw.invoices, raw.payrollRuns);
  const { current, previous } = getCurrentAndPreviousMonth(monthTotals);
  const deptData = computeDepartmentPayroll(raw.payrollRuns, raw.employees, raw.departments);

  return {
    totalRevenue: raw.totalRevenue,
    totalPayroll: raw.totalPayroll,
    netMargin: raw.totalRevenue - raw.totalPayroll,
    payrollMoM: raw.payrollMoM,
    activeEmployees: raw.employees.filter((e) => e.status === "active").length,
    processedRuns: raw.payrollRuns.filter((r) => r.status === "paid" || r.status === "processed")
      .length,
    topDepartments: deptData.slice(0, 5),
    currentMonthPayroll: current?.payroll ?? 0,
    previousMonthPayroll: previous?.payroll ?? 0,
  };
}

/** LLM-only path — call from a separate async endpoint so dashboard analytics stays fast. */
export async function generateAiPayrollInsights(
  raw: DashboardRawData
): Promise<PayrollInsightsResult | null> {
  try {
    const summary = buildPayrollInsightsSummary(raw);
    const aiInsights = await callLlmForPayrollInsights(JSON.stringify(summary));
    if (aiInsights.length > 0) {
      return { insights: aiInsights.slice(0, 4), source: "ai" };
    }
  } catch {
    return null;
  }
  return null;
}

export async function generatePayrollInsights(
  payrollRuns: PayrollRun[],
  employees: Employee[],
  departments: { id: string; name: string }[],
  invoices: Invoice[],
  totalRevenue: number,
  totalPayroll: number
): Promise<PayrollInsightsResult> {
  const monthTotals = getMonthTotals(invoices, payrollRuns);
  const { current, previous } = getCurrentAndPreviousMonth(monthTotals);
  const payrollMoM = computeMoMChange(current?.payroll ?? 0, previous?.payroll ?? 0);
  const deptData = computeDepartmentPayroll(payrollRuns, employees, departments);

  const ruleInsights = generateRuleBasedPayrollInsights(
    payrollRuns,
    employees,
    departments,
    totalRevenue,
    totalPayroll,
    payrollMoM
  );

  const summary = {
    totalRevenue,
    totalPayroll,
    netMargin: totalRevenue - totalPayroll,
    payrollMoM,
    activeEmployees: employees.filter((e) => e.status === "active").length,
    processedRuns: payrollRuns.filter((r) => r.status === "paid" || r.status === "processed")
      .length,
    topDepartments: deptData.slice(0, 5),
    currentMonthPayroll: current?.payroll ?? 0,
    previousMonthPayroll: previous?.payroll ?? 0,
  };

  try {
    const aiInsights = await callLlmForPayrollInsights(JSON.stringify(summary));
    if (aiInsights.length > 0) {
      return { insights: aiInsights.slice(0, 4), source: "ai" };
    }
  } catch {
    // fall through to rule-based insights
  }

  return { insights: ruleInsights, source: "rules" };
}
