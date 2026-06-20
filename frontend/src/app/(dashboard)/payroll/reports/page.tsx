"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPayrollRuns } from "@/lib/repositories/payroll";
import { getEmployees } from "@/lib/repositories/employees";
import { getDepartments } from "@/lib/repositories/departments";
import { useStorageDataWithLoading } from "@/hooks/use-storage-data";
import { KpiSkeleton } from "@/components/shared/skeletons";
import { formatCurrency } from "@/lib/utils";
import { RoleGate } from "@/components/auth/role-gate";
import { exportToCSV } from "@/lib/csv";
import { useAuth } from "@/providers/auth-provider";
import { recordExportAudit } from "@/lib/audit";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const COLORS = ["#2563eb", "#7c3aed", "#10b981", "#f59e0b", "#ef4444"];

export default function PayrollReportsPage() {
  const { session } = useAuth();
  const { data: runs, isLoading: runsLoading } = useStorageDataWithLoading(
    () => getPayrollRuns(),
    ["payroll_runs"]
  );
  const { data: employees, isLoading: employeesLoading } = useStorageDataWithLoading(
    () => getEmployees(),
    ["employees"]
  );
  const { data: departments, isLoading: departmentsLoading } = useStorageDataWithLoading(
    () => getDepartments(),
    ["departments"]
  );
  const isLoading = runsLoading || employeesLoading || departmentsLoading;

  const processedRuns = runs.filter((r) => r.status === "processed" || r.status === "paid");
  const totalExpense = processedRuns.reduce((s, r) => s + r.totalNet, 0);

  const monthlyTrend = processedRuns
    .slice(0, 12)
    .reverse()
    .map((r) => ({
      month: `${MONTHS[r.month - 1]} ${r.year}`,
      expense: r.totalNet,
    }));

  const deptExpenses: Record<string, number> = {};
  processedRuns.forEach((run) => {
    run.entries.forEach((entry) => {
      const emp = employees.find((e) => e.id === entry.employeeId);
      if (emp) {
        const dept = departments.find((d) => d.id === emp.departmentId);
        const deptName = dept?.name || "Unknown";
        deptExpenses[deptName] = (deptExpenses[deptName] || 0) + entry.netPay;
      }
    });
  });

  const deptChartData = Object.entries(deptExpenses).map(([name, value]) => ({ name, value }));

  const handleExportHistory = () => {
    const data = runs.map((r) => ({
      period: `${MONTHS[r.month - 1]} ${r.year}`,
      employees: r.entries.length,
      totalGross: r.totalGross,
      totalNet: r.totalNet,
      status: r.status,
    }));
    exportToCSV(data, [
      { key: "period", label: "Period" },
      { key: "employees", label: "Employees" },
      { key: "totalGross", label: "Total Gross" },
      { key: "totalNet", label: "Total Net" },
      { key: "status", label: "Status" },
    ], "payroll-history.csv");
    if (session) {
      void recordExportAudit("payroll", "Exported full payroll history CSV");
    }
    toast.success("Payroll history exported");
  };

  return (
    <RoleGate roles={["admin", "accountant", "hr"]}>
      <div className="space-y-6">
        <PageHeader title="Payroll Reports" description="Expense analytics and department breakdown">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportHistory}>Export History CSV</Button>
            <Button variant="outline" asChild>
              <Link href="/payroll">Back to Payroll</Link>
            </Button>
          </div>
        </PageHeader>

        {isLoading ? (
          <KpiSkeleton count={3} />
        ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Total Payroll Expense</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{formatCurrency(totalExpense)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Payroll Runs</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{runs.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Avg. Monthly Cost</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatCurrency(processedRuns.length ? totalExpense / processedRuns.length : 0)}
              </p>
            </CardContent>
          </Card>
        </div>
        )}

        {!isLoading && (
          <div className="grid gap-6 lg:grid-cols-2">
            {monthlyTrend.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Monthly Expense Trend</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="expense" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {deptChartData.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Department-wise Expense</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={deptChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                      >
                        {deptChartData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {!isLoading && runs.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <EmptyState
                icon="file"
                title="No payroll data yet"
                description="Run your first payroll to see expense analytics and department breakdowns."
                action={
                  <Button asChild>
                    <Link href="/payroll/run">Run Your First Payroll</Link>
                  </Button>
                }
              />
            </CardContent>
          </Card>
        )}
      </div>
    </RoleGate>
  );
}
