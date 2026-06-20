import type { Employee, Invoice, PayrollRun } from "@/types";

export function computeMoMChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

export function monthKey(date: string | Date): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function getMonthTotals(
  invoices: Invoice[],
  payrollRuns: PayrollRun[],
  monthsBack = 6
): { key: string; label: string; revenue: number; payroll: number; margin: number }[] {
  const now = new Date();
  const buckets: { key: string; label: string; revenue: number; payroll: number; margin: number }[] = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    buckets.push({ key, label, revenue: 0, payroll: 0, margin: 0 });
  }

  invoices
    .filter((inv) => inv.status === "paid")
    .forEach((inv) => {
      const key = monthKey(inv.issueDate);
      const bucket = buckets.find((b) => b.key === key);
      if (bucket) bucket.revenue += inv.total;
    });

  payrollRuns
    .filter((r) => r.status === "paid" || r.status === "processed")
    .forEach((run) => {
      const key = `${run.year}-${String(run.month).padStart(2, "0")}`;
      const bucket = buckets.find((b) => b.key === key);
      if (bucket) bucket.payroll += run.totalNet;
    });

  buckets.forEach((b) => {
    b.margin = b.revenue - b.payroll;
  });

  return buckets;
}

export function getCurrentAndPreviousMonth<T extends { key: string }>(
  buckets: T[]
): { current: T | undefined; previous: T | undefined } {
  if (buckets.length === 0) return { current: undefined, previous: undefined };
  const current = buckets[buckets.length - 1];
  const previous = buckets.length > 1 ? buckets[buckets.length - 2] : undefined;
  return { current, previous };
}

export function computeDepartmentPayroll(
  payrollRuns: PayrollRun[],
  employees: Employee[],
  departments: { id: string; name: string }[]
): { name: string; value: number }[] {
  const deptExpenses: Record<string, number> = {};

  payrollRuns
    .filter((r) => r.status === "paid" || r.status === "processed")
    .forEach((run) => {
      run.entries.forEach((entry) => {
        const emp = employees.find((e) => e.id === entry.employeeId);
        if (emp) {
          const dept = departments.find((d) => d.id === emp.departmentId);
          const deptName = dept?.name || "Unknown";
          deptExpenses[deptName] = (deptExpenses[deptName] || 0) + entry.netPay;
        }
      });
    });

  return Object.entries(deptExpenses).map(([name, value]) => ({ name, value }));
}

export interface DashboardInsight {
  id: string;
  text: string;
  type: "warning" | "info" | "success";
}

/** Rule-based billing highlights from current invoice and revenue data. */
export function generateDashboardInsights(
  invoices: Invoice[],
  clients: { id: string; name: string }[],
  revenueMoM: number | null,
  overdueCount: number,
  overdueTotal: number
): DashboardInsight[] {
  const insights: DashboardInsight[] = [];

  if (overdueCount > 0) {
    insights.push({
      id: "overdue",
      text: `${overdueCount} overdue invoice${overdueCount !== 1 ? "s" : ""} totaling ${overdueTotal.toLocaleString("en-US", { style: "currency", currency: "USD" })} — consider sending payment reminders.`,
      type: "warning",
    });
  }

  if (revenueMoM !== null) {
    const direction = revenueMoM >= 0 ? "up" : "down";
    insights.push({
      id: "revenue-mom",
      text: `Revenue is ${direction} ${Math.abs(revenueMoM).toFixed(1)}% month-over-month based on paid invoices.`,
      type: revenueMoM >= 0 ? "success" : "warning",
    });
  }

  const sentCount = invoices.filter((i) => i.status === "sent").length;
  if (sentCount > 0) {
    insights.push({
      id: "sent-followup",
      text: `${sentCount} sent invoice${sentCount !== 1 ? "s" : ""} awaiting payment — follow up before due dates pass.`,
      type: "info",
    });
  }

  const topClient = clients[0];
  if (topClient && invoices.length > 0) {
    const clientInvoices = invoices.filter((i) => i.clientId === topClient.id && i.status !== "paid");
    if (clientInvoices.length > 0) {
      insights.push({
        id: "client-focus",
        text: `${topClient.name} has ${clientInvoices.length} open invoice${clientInvoices.length !== 1 ? "s" : ""} — prioritize relationship management.`,
        type: "info",
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      id: "all-clear",
      text: "Billing looks healthy. No urgent follow-ups detected this month.",
      type: "success",
    });
  }

  return insights.slice(0, 4);
}
