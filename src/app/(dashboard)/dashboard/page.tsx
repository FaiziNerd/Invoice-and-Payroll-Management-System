"use client";

import { useMemo } from "react";
import { useAuth } from "@/providers/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getInvoices } from "@/lib/mock-db/invoices";
import { getPayrollRuns } from "@/lib/mock-db/payroll";
import { getClients } from "@/lib/mock-db/clients";
import { computeInvoiceAging } from "@/lib/invoices/aging";
import { useStorageData } from "@/hooks/use-storage-data";
import { formatCurrency } from "@/lib/utils";
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
  LineChart,
  Line,
} from "recharts";
import { FileText, DollarSign, AlertTriangle, Users, TrendingUp, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToCSV, generateCSV } from "@/lib/csv";
import { addAuditLog } from "@/lib/audit";
import JSZip from "jszip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvoiceStatusBadge } from "@/components/shared/status-badge";
import Link from "next/link";

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444"];

function ChartPlaceholder({ message }: { message: string }) {
  return (
    <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export default function DashboardPage() {
  const { session, hasRole } = useAuth();

  const invoices = useStorageData(() => getInvoices(), ["invoices"]);
  const payrollRuns = useStorageData(() => getPayrollRuns(), ["payroll_runs"]);
  const clients = useStorageData(() => getClients(), ["clients"]);

  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const overdueInvoices = invoices.filter((i) => i.status === "overdue");
  const sentInvoices = invoices.filter((i) => i.status === "sent");

  const totalRevenue = paidInvoices.reduce((s, i) => s + i.total, 0);
  const outstanding = [...overdueInvoices, ...sentInvoices].reduce((s, i) => s + i.total, 0);
  const totalPayroll = payrollRuns
    .filter((r) => r.status === "paid" || r.status === "processed")
    .reduce((s, r) => s + r.totalNet, 0);

  const revenueByMonth = useMemo(() => {
    const months: Record<string, number> = {};
    paidInvoices.forEach((inv) => {
      const d = new Date(inv.issueDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months[key] = (months[key] || 0) + inv.total;
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, revenue]) => ({
        month: month.slice(5) + "/" + month.slice(0, 4),
        revenue,
      }));
  }, [paidInvoices]);

  const invoiceStatusData = [
    { name: "Paid", value: paidInvoices.length },
    { name: "Sent", value: sentInvoices.length },
    { name: "Overdue", value: overdueInvoices.length },
    { name: "Draft", value: invoices.filter((i) => i.status === "draft").length },
  ];

  const agingData = useMemo(() => computeInvoiceAging(invoices), [invoices]);

  const payrollTrend = payrollRuns
    .slice(0, 6)
    .reverse()
    .map((r) => ({
      month: `${r.month}/${r.year}`,
      expense: r.totalNet,
    }));

  const showInvoiceWidgets = hasRole("admin", "accountant");
  const showPayrollWidgets = hasRole("admin", "hr", "accountant");
  const showNetMargin = showInvoiceWidgets && showPayrollWidgets;

  const handleExportOutstanding = () => {
    const data = [...overdueInvoices, ...sentInvoices].map((inv) => {
      const client = clients.find((c) => c.id === inv.clientId);
      return {
        invoiceNumber: inv.invoiceNumber,
        client: client?.name || "Unknown",
        amount: inv.total,
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
      addAuditLog({
        action: "export",
        entity: "dashboard",
        userId: session.userId,
        userName: session.name,
        description: "Exported outstanding payments CSV",
      });
    }
  };

  const handleExportDashboard = async () => {
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
              amount: inv.total,
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
      addAuditLog({
        action: "export",
        entity: "dashboard",
        userId: session.userId,
        userName: session.name,
        description: "Exported full dashboard data",
      });
    }
  };

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
                <p className="text-xs text-muted-foreground">{paidInvoices.length} paid invoices</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(outstanding)}</div>
                <p className="text-xs text-muted-foreground">
                  {overdueInvoices.length} overdue, {sentInvoices.length} sent
                </p>
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
              <p className="text-xs text-muted-foreground">{payrollRuns.length} payroll runs</p>
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
              <p className="text-xs text-muted-foreground">Revenue minus payroll</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {showInvoiceWidgets && (
          <Card>
            <CardHeader>
              <CardTitle>Revenue Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {revenueByMonth.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={revenueByMonth}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
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
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={invoiceStatusData.filter((d) => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {invoiceStatusData.filter((d) => d.value > 0).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
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
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={agingData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="amount" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartPlaceholder message="No outstanding invoices to age" />
              )}
            </CardContent>
          </Card>
        )}

        {showPayrollWidgets && (
          <Card>
            <CardHeader>
              <CardTitle>Payroll Expense Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {payrollTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={payrollTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Line type="monotone" dataKey="expense" stroke="#7c3aed" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <ChartPlaceholder message="No payroll data yet" />
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...overdueInvoices, ...sentInvoices].map((inv) => {
                    const client = clients.find((c) => c.id === inv.clientId);
                    return (
                      <TableRow key={inv.id}>
                        <TableCell>
                          <Link href={`/invoices/${inv.id}`} className="text-primary hover:underline">
                            {inv.invoiceNumber}
                          </Link>
                        </TableCell>
                        <TableCell>{client?.name}</TableCell>
                        <TableCell>{formatCurrency(inv.total)}</TableCell>
                        <TableCell><InvoiceStatusBadge status={inv.status} /></TableCell>
                        <TableCell>{new Date(inv.dueDate).toLocaleDateString()}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-3 md:hidden">
              {[...overdueInvoices, ...sentInvoices].map((inv) => {
                const client = clients.find((c) => c.id === inv.clientId);
                return (
                  <div key={inv.id} className="rounded-lg border p-4">
                    <div className="flex justify-between">
                      <Link href={`/invoices/${inv.id}`} className="font-medium text-primary">
                        {inv.invoiceNumber}
                      </Link>
                      <InvoiceStatusBadge status={inv.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">{client?.name}</p>
                    <p className="font-semibold">{formatCurrency(inv.total)}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
