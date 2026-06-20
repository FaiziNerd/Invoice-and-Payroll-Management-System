"use client";

import { use, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Download, Play } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getPayrollRunById,
  updatePayrollEntry,
  processPayrollRun,
  markPayrollPaid,
} from "@/lib/repositories/payroll";
import { getEmployees } from "@/lib/repositories/employees";
import { useStorageData, useCompanyDataReady } from "@/hooks/use-storage-data";
import { CardGridSkeleton } from "@/components/shared/skeletons";
import { PayrollStatusBadge } from "@/components/shared/status-badge";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import { RoleGate } from "@/components/auth/role-gate";
import { exportToCSV } from "@/lib/csv";
import { addAuditLog } from "@/lib/audit";
import type { PayrollRun } from "@/types";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function PayrollDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = use(params);
  const router = useRouter();
  const { session } = useAuth();
  const dataReady = useCompanyDataReady();
  const [run, setRun] = useState<PayrollRun | undefined>(() => getPayrollRunById(runId));

  const refresh = () => setRun(getPayrollRunById(runId));

  const employees = useStorageData(() => getEmployees(), ["employees"]);
  const employeeMap = useMemo(() => {
    return new Map(employees.map((emp) => [emp.id, emp]));
  }, [employees]);

  if (!dataReady) {
    return <RoleGate roles={["admin", "accountant", "hr"]}><CardGridSkeleton count={3} /></RoleGate>;
  }

  if (!run) {
    return (
      <RoleGate roles={["admin", "accountant", "hr"]}>
        <EmptyState
          icon="file"
          title="Payroll run not found"
          description="This payroll run may have been deleted or the link is invalid."
          action={
            <Button asChild>
              <Link href="/payroll">Back to Payroll</Link>
            </Button>
          }
        />
      </RoleGate>
    );
  }

  const handleEntryUpdate = async (entryId: string, field: "bonus" | "oneOffDeduction", value: number) => {
    if (!session) return;
    const updated = await updatePayrollEntry(runId, entryId, { [field]: value }, session.userId, session.name);
    if (updated) {
      setRun(updated);
    } else {
      refresh();
    }
  };

  const handleProcess = async () => {
    if (!session) return;
    const result = await processPayrollRun(runId, session.userId, session.name);
    if (!result) {
      toast.error("Failed to process payroll");
      return;
    }
    setRun(result);
    toast.success("Payroll processed");
  };

  const handleMarkPaid = async () => {
    if (!session) return;
    const result = await markPayrollPaid(runId, session.userId, session.name);
    if (!result) {
      toast.error("Failed to mark payroll as paid");
      return;
    }
    setRun(result);
    toast.success("Payroll marked as paid");
  };

  const handleExport = () => {
    const data = run.entries.map((entry) => {
      const emp = employeeMap.get(entry.employeeId);
      return {
        employee: emp ? `${emp.firstName} ${emp.lastName}` : "Unknown",
        employeeId: emp?.employeeId || "",
        baseSalary: entry.baseSalary,
        grossPay: entry.grossPay,
        deductions: entry.totalDeductions,
        netPay: entry.netPay,
        bonus: entry.bonus,
        oneOffDeduction: entry.oneOffDeduction,
      };
    });
    exportToCSV(data, [
      { key: "employeeId", label: "Employee ID" },
      { key: "employee", label: "Employee" },
      { key: "baseSalary", label: "Base Salary" },
      { key: "bonus", label: "Bonus" },
      { key: "grossPay", label: "Gross Pay" },
      { key: "deductions", label: "Deductions" },
      { key: "oneOffDeduction", label: "One-off Deduction" },
      { key: "netPay", label: "Net Pay" },
    ], `payroll-${run.month}-${run.year}.csv`);
    if (session) {
      addAuditLog({
        action: "export",
        entity: "payroll",
        entityId: runId,
        userId: session.userId,
        userName: session.name,
        description: `Exported payroll for ${run.month}/${run.year}`,
      });
    }
    toast.success("CSV exported");
  };

  return (
    <RoleGate roles={["admin", "accountant", "hr"]}>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Payroll", href: "/payroll" },
            { label: `${MONTHS[run.month - 1]} ${run.year}` },
          ]}
        />
        <PageHeader
          title={`${MONTHS[run.month - 1]} ${run.year} Payroll`}
          description={`${run.entries.length} employees`}
        >
          <div className="flex flex-wrap gap-2">
            <PayrollStatusBadge status={run.status} />
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            {run.status === "draft" && (
              <Button size="sm" onClick={handleProcess}>
                <Play className="h-4 w-4" /> Process
              </Button>
            )}
            {run.status === "processed" && (
              <>
                <Button size="sm" onClick={handleMarkPaid}>
                  <CheckCircle className="h-4 w-4" /> Mark Paid
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/salary-slips/${runId}`}>Generate Slips</Link>
                </Button>
              </>
            )}
            {run.status === "paid" && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/salary-slips/${runId}`}>View Slips</Link>
              </Button>
            )}
          </div>
        </PageHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Total Gross</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{formatCurrency(run.totalGross)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Total Net</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(run.totalNet)}</p></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Employee Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Base</TableHead>
                    <TableHead>Bonus</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>One-off Ded.</TableHead>
                    <TableHead>Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {run.entries.map((entry) => {
                    const emp = employeeMap.get(entry.employeeId);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {emp ? `${emp.firstName} ${emp.lastName}` : "Unknown"}
                        </TableCell>
                        <TableCell>{formatCurrency(entry.baseSalary)}</TableCell>
                        <TableCell>
                          {run.status === "draft" ? (
                            <Input
                              type="number"
                              className="w-20 h-8"
                              value={entry.bonus}
                              onChange={(e) => handleEntryUpdate(entry.id, "bonus", Number(e.target.value))}
                            />
                          ) : (
                            formatCurrency(entry.bonus)
                          )}
                        </TableCell>
                        <TableCell>{formatCurrency(entry.grossPay)}</TableCell>
                        <TableCell>{formatCurrency(entry.totalDeductions - entry.oneOffDeduction)}</TableCell>
                        <TableCell>
                          {run.status === "draft" ? (
                            <Input
                              type="number"
                              className="w-20 h-8"
                              value={entry.oneOffDeduction}
                              onChange={(e) => handleEntryUpdate(entry.id, "oneOffDeduction", Number(e.target.value))}
                            />
                          ) : (
                            formatCurrency(entry.oneOffDeduction)
                          )}
                        </TableCell>
                        <TableCell className="font-semibold">{formatCurrency(entry.netPay)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-3 md:hidden">
              {run.entries.map((entry) => {
                const emp = employeeMap.get(entry.employeeId);
                return (
                  <div key={entry.id} className="rounded-lg border p-4">
                    <p className="font-medium">{emp ? `${emp.firstName} ${emp.lastName}` : "Unknown"}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <span>Gross: {formatCurrency(entry.grossPay)}</span>
                      <span>Net: {formatCurrency(entry.netPay)}</span>
                    </div>
                    {run.status === "draft" && (
                      <div className="mt-2 flex gap-2">
                        <Input
                          type="number"
                          placeholder="Bonus"
                          className="h-8"
                          value={entry.bonus}
                          onChange={(e) => handleEntryUpdate(entry.id, "bonus", Number(e.target.value))}
                        />
                        <Input
                          type="number"
                          placeholder="Deduction"
                          className="h-8"
                          value={entry.oneOffDeduction}
                          onChange={(e) => handleEntryUpdate(entry.id, "oneOffDeduction", Number(e.target.value))}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Button variant="outline" onClick={() => router.push("/payroll")}>Back to Payroll</Button>
      </div>
    </RoleGate>
  );
}
