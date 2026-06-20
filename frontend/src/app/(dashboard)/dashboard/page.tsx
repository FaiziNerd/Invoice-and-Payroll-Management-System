"use client";

import { useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  sendInvoiceEmail,
} from "@/lib/repositories/invoices";
import { useClients } from "@/hooks/use-clients";
import { useCompanyDataReady } from "@/hooks/use-storage-data";
import { useDashboardAnalytics } from "@/hooks/use-dashboard-analytics";
import { KpiSkeleton } from "@/components/shared/skeletons";
import { formatCurrency } from "@/lib/utils";
import dynamic from "next/dynamic";

const RevenueChart = dynamic(() => import("@/components/dashboard/dashboard-charts").then((m) => m.RevenueChart), { ssr: false });
const InvoiceAnalyticsChart = dynamic(() => import("@/components/dashboard/dashboard-charts").then((m) => m.InvoiceAnalyticsChart), { ssr: false });
const InvoiceAgingChart = dynamic(() => import("@/components/dashboard/dashboard-charts").then((m) => m.InvoiceAgingChart), { ssr: false });
const PayrollTrendChart = dynamic(() => import("@/components/dashboard/dashboard-charts").then((m) => m.PayrollTrendChart), { ssr: false });
const DeptPayrollChart = dynamic(() => import("@/components/dashboard/dashboard-charts").then((m) => m.DeptPayrollChart), { ssr: false });
const NetMarginTrendChart = dynamic(() => import("@/components/dashboard/dashboard-charts").then((m) => m.NetMarginTrendChart), { ssr: false });
import {
  FileText,
  DollarSign,
  AlertTriangle,
  Users,
  TrendingUp,
  TrendingDown,
  Download,
  Bell,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToCSV, generateCSV } from "@/lib/csv";
import { recordExportAudit } from "@/lib/audit";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvoiceStatusBadge } from "@/components/shared/status-badge";
import { InvoiceEmailDialog } from "@/components/invoices/invoice-email-dialog";
import Link from "next/link";
import { toast } from "sonner";
import type { Invoice } from "@/types";

function ChartPlaceholder({ message }: { message: string }) {
  return (
    <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function MoMBadge({ change }: { change: number | null }) {
  if (change === null) return null;
  const positive = change >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        positive ? "text-green-600 dark:text-green-400" : "text-destructive"
      }`}
    >
      <Icon className="h-3 w-3" />
      {positive ? "+" : ""}
      {change.toFixed(1)}% MoM
    </span>
  );
}

export default function DashboardPage() {
  const { session, hasRole } = useAuth();
  const [reminderInvoice, setReminderInvoice] = useState<Invoice | null>(null);

  const companyReady = useCompanyDataReady();
  const showInvoiceWidgets = hasRole("admin", "accountant");
  const showPayrollWidgets = hasRole("admin", "hr", "accountant");
  const showNetMargin = showInvoiceWidgets && showPayrollWidgets;
  const analyticsEnabled = companyReady && (showInvoiceWidgets || showPayrollWidgets);
  const { data: analytics, loading: analyticsLoading } = useDashboardAnalytics(analyticsEnabled);
  const { clients } = useClients();

  const totalRevenue = analytics?.totalRevenue ?? 0;
  const outstanding = analytics?.outstanding ?? 0;
  const totalPayroll = analytics?.totalPayroll ?? 0;
  const revenueMoM = analytics?.revenueMoM ?? null;
  const outstandingMoM = analytics?.outstandingMoM ?? null;
  const payrollMoM = analytics?.payrollMoM ?? null;
  const marginMoM = analytics?.marginMoM ?? null;
  const netMarginTrend = analytics?.netMarginTrend ?? [];
  const deptChartData = analytics?.deptChartData ?? [];
  const dashboardInsights = analytics?.insights ?? [];
  const revenueByMonth = analytics?.revenueByMonth ?? [];
  const invoiceStatusData = analytics?.invoiceStatusData ?? [];
  const agingData = analytics?.agingData ?? [];
  const payrollTrend = analytics?.payrollTrend ?? [];
  const reminderCandidates = analytics?.reminderCandidates ?? [];
  const outstandingExportRows = analytics?.outstandingExportRows ?? [];
  const overdueInvoices = outstandingExportRows.filter((row) => row.status === "overdue");
  const sentInvoices = outstandingExportRows.filter((row) => row.status === "sent");
  const paidInvoicesCount =
    invoiceStatusData.find((row) => row.name === "Paid")?.value ?? 0;
  const isLoading = !companyReady || analyticsLoading;

  const handleSendReminder = async (candidate: {
    id: string;
    clientId: string;
  }) => {
    try {
      const res = await fetch(`/api/invoices/${candidate.id}`, { credentials: "include" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to load invoice");
      setReminderInvoice(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load invoice");
    }
  };

  const handleReminderConfirm = async () => {
    if (!session || !reminderInvoice) return;
    const client = clients.find((c) => c.id === reminderInvoice.clientId);
    if (!client) return;
    try {
      await sendInvoiceEmail(
        reminderInvoice.id,
        session.userId,
        session.name,
        client.email,
        "reminder"
      );
      toast.success(`Payment reminder sent to ${client.email}`);
      setReminderInvoice(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reminder");
    }
  };

  const handleExportOutstanding = () => {
    const data = [...overdueInvoices, ...sentInvoices].map((inv) => {
      const client = clients.find((c) => c.id === inv.clientId);
      return {
        invoiceNumber: inv.invoiceNumber,
        client: client?.name || "Unknown",
        amount: inv.amount,
        status: inv.status,
        dueDate: inv.dueDate,
      };
    });
    exportToCSV(data, [
      { key: "invoiceNumber", label: "Invoice" },
      { key: "client", label: "Client" },
      { key: "amount", label: "Amount" },
      { key: "status", label: "Status" },
      { key: "dueDate", label: "Due Date" },
    ], "outstanding-payments.csv");
    if (session) {
      void recordExportAudit("dashboard", "Exported outstanding payments CSV");
    }
  };

  const handleExportDashboard = async () => {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    const summaryRows: { metric: string; value: string }[] = [];
    if (showInvoiceWidgets) {
      summaryRows.push(
        { metric: "Total Revenue", value: String(totalRevenue) },
        { metric: "Outstanding", value: String(outstanding) },
      );
    }
    if (showPayrollWidgets) {
      summaryRows.push({ metric: "Payroll Expense", value: String(totalPayroll) });
    }
    if (showNetMargin) {
      summaryRows.push({ metric: "Net Margin", value: String(totalRevenue - totalPayroll) });
    }
    if (summaryRows.length > 0) {
      zip.file(
        "summary.csv",
        generateCSV(summaryRows, [
          { key: "metric", label: "Metric" },
          { key: "value", label: "Value" },
        ])
      );
    }

    if (showInvoiceWidgets) {
      zip.file(
        "invoice-aging.csv",
        generateCSV(
          agingData.map((d) => ({
            bucket: d.label,
            count: d.count,
            amount: d.amount,
          })),
          [
            { key: "bucket", label: "Aging Bucket" },
            { key: "count", label: "Invoice Count" },
            { key: "amount", label: "Amount" },
          ]
        )
      );
      zip.file(
        "revenue-by-month.csv",
        generateCSV(revenueByMonth, [
          { key: "month", label: "Month" },
          { key: "revenue", label: "Revenue" },
        ])
      );
      zip.file(
        "invoice-status.csv",
        generateCSV(invoiceStatusData, [
          { key: "name", label: "Status" },
          { key: "value", label: "Count" },
        ])
      );
      zip.file(
        "outstanding-payments.csv",
        generateCSV(
          [...overdueInvoices, ...sentInvoices].map((inv) => {
            const client = clients.find((c) => c.id === inv.clientId);
            return {
              invoiceNumber: inv.invoiceNumber,
              client: client?.name || "Unknown",
              amount: inv.amount,
              status: inv.status,
              dueDate: inv.dueDate,
            };
          }),
          [
            { key: "invoiceNumber", label: "Invoice" },
            { key: "client", label: "Client" },
            { key: "amount", label: "Amount" },
            { key: "status", label: "Status" },
            { key: "dueDate", label: "Due Date" },
          ]
        )
      );
    }

    if (showPayrollWidgets) {
      zip.file(
        "payroll-trend.csv",
        generateCSV(payrollTrend, [
          { key: "month", label: "Month" },
          { key: "expense", label: "Expense" },
        ])
      );
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dashboard-export.zip";
    link.click();
    URL.revokeObjectURL(url);

    if (session) {
      void recordExportAudit("dashboard", "Exported full dashboard data");
    }
  };

  const reminderClient = reminderInvoice
    ? clients.find((c) => c.id === reminderInvoice.clientId)
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Financial overview and analytics"
      >
        <Button variant="outline" onClick={handleExportDashboard}>
          <Download className="h-4 w-4" /> Export Dashboard
        </Button>
      </PageHeader>

      {!isLoading ? (
        <KpiSkeleton />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {showInvoiceWidgets && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-muted-foreground">{paidInvoicesCount} paid invoices</p>
                    <MoMBadge change={revenueMoM} />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(outstanding)}</div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-muted-foreground">
                      {overdueInvoices.length} overdue, {sentInvoices.length} sent
                    </p>
                    <MoMBadge change={outstandingMoM} />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
          {showPayrollWidgets && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Payroll Expense</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalPayroll)}</div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">{payrollTrend.length} recent payroll runs</p>
                  <MoMBadge change={payrollMoM} />
                </div>
              </CardContent>
            </Card>
          )}
          {showNetMargin && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Net Margin</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(totalRevenue - totalPayroll)}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">Revenue minus payroll</p>
                  <MoMBadge change={marginMoM} />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {showInvoiceWidgets && (
        <div>
          <h2 className="text-base font-semibold mb-4 pb-2 border-b">Insights</h2>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {showInvoiceWidgets && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Smart Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {dashboardInsights.map((insight) => (
                  <li
                    key={insight.id}
                    className={`rounded-lg border px-4 py-3 text-sm ${
                      insight.type === "warning"
                        ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
                        : insight.type === "success"
                          ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30"
                          : "border-border bg-muted/30"
                    }`}
                  >
                    {insight.text}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {showInvoiceWidgets && reminderCandidates.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Payment Reminders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {reminderCandidates.length} invoice{reminderCandidates.length !== 1 ? "s" : ""} eligible for payment reminders.
              </p>
              <div className="space-y-2">
                {reminderCandidates.slice(0, 5).map((inv) => {
                  const client = clients.find((c) => c.id === inv.clientId);
                  return (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between rounded-lg border px-3 py-2"
                    >
                      <div>
                        <Link href={`/invoices/${inv.id}`} className="text-sm font-medium text-primary hover:underline">
                          {inv.invoiceNumber}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {client?.name} · {formatCurrency(inv.total)}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendReminder(inv)}
                      >
                        <Bell className="h-3 w-3" /> Remind
                      </Button>
                    </div>
                  );
                })}
              </div>
              {reminderCandidates.length > 5 && (
                <p className="text-xs text-muted-foreground mt-3">
                  +{reminderCandidates.length - 5} more — view all on the{" "}
                  <Link href="/invoices" className="text-primary hover:underline">Invoices</Link> page.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {showInvoiceWidgets && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <h2 className="text-base font-semibold pb-1 border-b">Revenue</h2>
            </CardHeader>
          </Card>
        )}

        {showInvoiceWidgets && (
          <Card>
            <CardHeader>
              <CardTitle>Revenue Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {revenueByMonth.some((d) => d.revenue > 0) ? (
                <div role="img" aria-label="Revenue overview bar chart showing monthly revenue totals">
                  <span className="sr-only">
                    Monthly revenue chart. Most recent month:{" "}
                    {revenueByMonth[revenueByMonth.length - 1]?.month ?? "N/A"} —{" "}
                    {formatCurrency(revenueByMonth[revenueByMonth.length - 1]?.revenue ?? 0)}.
                    Total revenue: {formatCurrency(totalRevenue)}.
                  </span>
                  <RevenueChart data={revenueByMonth} />
                </div>
              ) : (
                <ChartPlaceholder message="No revenue data yet" />
              )}
            </CardContent>
          </Card>
        )}

        {showInvoiceWidgets && (
          <Card>
            <CardHeader>
              <CardTitle>Invoice Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              {invoiceStatusData.some((d) => d.value > 0) ? (
                <div role="img" aria-label="Invoice analytics donut chart showing breakdown by status">
                  <span className="sr-only">
                    Invoice status breakdown: {invoiceStatusData.map((d) => `${d.name}: ${d.value}`).join(", ")}.
                    Total invoices: {invoiceStatusData.reduce((sum, row) => sum + row.value, 0)}.
                  </span>
                  <InvoiceAnalyticsChart data={invoiceStatusData} />
                </div>
              ) : (
                <ChartPlaceholder message="No invoice data yet" />
              )}
            </CardContent>
          </Card>
        )}

        {showInvoiceWidgets && (
          <Card>
            <CardHeader>
              <CardTitle>Invoice Aging</CardTitle>
            </CardHeader>
            <CardContent>
              {agingData.some((d) => d.count > 0) ? (
                <div role="img" aria-label="Invoice aging bar chart showing outstanding amounts by age bucket">
                  <InvoiceAgingChart data={agingData} />
                </div>
              ) : (
                <ChartPlaceholder message="No outstanding invoices to age" />
              )}
            </CardContent>
          </Card>
        )}

        {showPayrollWidgets && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <h2 className="text-base font-semibold pb-1 border-b">Payroll</h2>
            </CardHeader>
          </Card>
        )}

        {showPayrollWidgets && (
          <Card>
            <CardHeader>
              <CardTitle>Payroll Expense Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {payrollTrend.length > 0 ? (
                <div role="img" aria-label="Payroll expense trend line chart showing monthly payroll costs">
                  <PayrollTrendChart data={payrollTrend} />
                </div>
              ) : (
                <ChartPlaceholder message="No payroll data yet" />
              )}
            </CardContent>
          </Card>
        )}

        {showPayrollWidgets && deptChartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Department Payroll Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div role="img" aria-label="Department payroll breakdown donut chart showing payroll cost per department">
                <DeptPayrollChart data={deptChartData} />
              </div>
            </CardContent>
          </Card>
        )}

        {showNetMargin && (
          <Card>
            <CardHeader>
              <CardTitle>Net Margin Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {netMarginTrend.some((d) => d.margin !== 0) ? (
                <div role="img" aria-label="Net margin trend line chart showing monthly revenue minus payroll">
                  <NetMarginTrendChart data={netMarginTrend} />
                </div>
              ) : (
                <ChartPlaceholder message="No margin data yet" />
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {showInvoiceWidgets && (overdueInvoices.length > 0 || sentInvoices.length > 0) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Outstanding Payments
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleExportOutstanding}>
              Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...overdueInvoices, ...sentInvoices].slice(0, 5).map((inv) => {
                    const client = clients.find((c) => c.id === inv.clientId);
                    return (
                      <TableRow key={inv.id}>
                        <TableCell>
                          <Link href={`/invoices/${inv.id}`} className="text-primary hover:underline">
                            {inv.invoiceNumber}
                          </Link>
                        </TableCell>
                        <TableCell>{client?.name}</TableCell>
                        <TableCell>{formatCurrency(inv.amount)}</TableCell>
                        <TableCell><InvoiceStatusBadge status={inv.status as Invoice["status"]} /></TableCell>
                        <TableCell>{new Date(inv.dueDate).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSendReminder(inv)}
                          >
                            <Bell className="h-3 w-3" /> Remind
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-3 md:hidden">
              {[...overdueInvoices, ...sentInvoices].slice(0, 5).map((inv) => {
                const client = clients.find((c) => c.id === inv.clientId);
                return (
                  <div key={inv.id} className="rounded-lg border p-4">
                    <div className="flex justify-between">
                      <Link href={`/invoices/${inv.id}`} className="font-medium text-primary">
                        {inv.invoiceNumber}
                      </Link>
                      <InvoiceStatusBadge status={inv.status as Invoice["status"]} />
                    </div>
                    <p className="text-sm text-muted-foreground">{client?.name}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="font-semibold">{formatCurrency(inv.amount)}</p>
                      <Button variant="outline" size="sm" onClick={() => handleSendReminder(inv)}>
                        <Bell className="h-3 w-3" /> Remind
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            {([...overdueInvoices, ...sentInvoices].length > 5) && (
              <div className="mt-3 text-sm text-muted-foreground">
                Showing 5 of {[...overdueInvoices, ...sentInvoices].length} outstanding.{" "}
                <Link href="/invoices" className="text-primary hover:underline">
                  View all invoices →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {reminderInvoice && reminderClient && (
        <InvoiceEmailDialog
          open={!!reminderInvoice}
          onOpenChange={(open) => !open && setReminderInvoice(null)}
          invoice={reminderInvoice}
          client={reminderClient}
          mode="reminder"
          onConfirm={handleReminderConfirm}
        />
      )}
    </div>
  );
}
