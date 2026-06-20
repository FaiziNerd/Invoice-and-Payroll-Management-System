"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { Pencil, Download } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getEmployeeById,
  fetchEmployeeById,
  calculateGrossPay,
  calculateTotalDeductions,
  calculateNetPay,
} from "@/lib/repositories/employees";
import { getDepartmentById } from "@/lib/repositories/departments";
import { getSlipsByEmployeeId } from "@/lib/repositories/salary-slips";
import { useStorageData } from "@/hooks/use-storage-data";
import { formatCurrency, formatDate } from "@/lib/utils";
import { RoleGate } from "@/components/auth/role-gate";
import { toast } from "sonner";
import type { Employee } from "@/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [employee, setEmployee] = useState<Employee | undefined>(() => getEmployeeById(id));
  const [isLoadingEmployee, setIsLoadingEmployee] = useState(!getEmployeeById(id));
  const slips = useStorageData(() => getSlipsByEmployeeId(id), ["salary_slips"]);

  useEffect(() => {
    if (employee) return;
    fetchEmployeeById(id).then((emp) => { setEmployee(emp); setIsLoadingEmployee(false); });
  }, [id, employee]);

  const handleDownloadSlip = async (slipId: string) => {
    const slip = slips.find((s) => s.id === slipId);
    const emp = getEmployeeById(id);
    if (!slip || !emp) return;
    try {
      const { downloadSalarySlipPDF } = await import("@/lib/pdf/salary-slip-pdf");
      await downloadSalarySlipPDF(slip, emp);
      toast.success("Salary slip downloaded");
    } catch {
      toast.error("Failed to download salary slip");
    }
  };

  if (isLoadingEmployee) {
    return (
      <RoleGate roles={["admin", "hr"]}>
        <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>
      </RoleGate>
    );
  }

  if (!employee) {
    return (
      <RoleGate roles={["admin", "hr"]}>
        <EmptyState
          icon="users"
          title="Employee not found"
          description="This employee may have been deleted or the link is invalid."
          action={
            <Button asChild>
              <Link href="/employees">Back to Employees</Link>
            </Button>
          }
        />
      </RoleGate>
    );
  }

  const dept = getDepartmentById(employee.departmentId);
  const { salaryStructure } = employee;
  const gross = calculateGrossPay(salaryStructure);
  const deductions = calculateTotalDeductions(salaryStructure);
  const net = calculateNetPay(salaryStructure);

  return (
    <RoleGate roles={["admin", "hr"]}>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Employees", href: "/employees" },
            { label: `${employee.firstName} ${employee.lastName}` },
          ]}
        />
        <PageHeader
          title={`${employee.firstName} ${employee.lastName}`}
          description={`${employee.position} · ${dept?.name}`}
        >
          <div className="flex items-center gap-2">
            <Badge variant={employee.status === "active" ? "success" : "secondary"}>
              {employee.status}
            </Badge>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/employees/${id}/edit`}><Pencil className="h-4 w-4" /> Edit</Link>
            </Button>
          </div>
        </PageHeader>

        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="salary">Salary Structure</TabsTrigger>
            <TabsTrigger value="history">Salary History</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4">
            <Card>
              <CardContent className="pt-6 grid gap-4 sm:grid-cols-2">
                <div><p className="text-sm text-muted-foreground">Employee ID</p><p className="font-medium">{employee.employeeId}</p></div>
                <div><p className="text-sm text-muted-foreground">Email</p><p className="font-medium">{employee.email}</p></div>
                <div><p className="text-sm text-muted-foreground">Phone</p><p className="font-medium">{employee.phone}</p></div>
                <div><p className="text-sm text-muted-foreground">Join Date</p><p className="font-medium">{formatDate(employee.joinDate)}</p></div>
                <div><p className="text-sm text-muted-foreground">Department</p><p className="font-medium">{dept?.name}</p></div>
                <div><p className="text-sm text-muted-foreground">Position</p><p className="font-medium">{employee.position}</p></div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="salary" className="mt-4">
            <div className="flex justify-end mb-4">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/employees/${id}/edit`}><Pencil className="h-4 w-4" /> Edit Salary Structure</Link>
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Gross Pay</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{formatCurrency(gross)}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Deductions</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-destructive">{formatCurrency(deductions)}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Net Pay</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(net)}</p></CardContent>
              </Card>
            </div>
            <Card className="mt-4">
              <CardContent className="pt-6">
                <p className="font-medium mb-2">Base: {formatCurrency(salaryStructure.baseSalary)}</p>
                <p className="text-sm text-muted-foreground mb-1">Allowances:</p>
                {salaryStructure.allowances.map((a) => (
                  <p key={a.id} className="text-sm ml-4">{a.name}: {formatCurrency(a.amount)}</p>
                ))}
                <p className="text-sm text-muted-foreground mt-2 mb-1">Deductions:</p>
                {salaryStructure.deductions.map((d) => (
                  <p key={d.id} className="text-sm ml-4">{d.name}: {formatCurrency(d.amount)}</p>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {slips.length === 0 ? (
                  <EmptyState
                    icon="file"
                    title="No salary history yet"
                    description="Salary slips will appear here after payroll is processed."
                  />
                ) : (
                  <div className="space-y-3">
                    {slips.map((slip) => (
                      <div key={slip.id} className="flex justify-between items-center border-b pb-3">
                        <span>{MONTHS[slip.month - 1]} {slip.year}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{formatCurrency(slip.netPay)}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Download salary slip for ${MONTHS[slip.month - 1]} ${slip.year}`}
                            onClick={() => handleDownloadSlip(slip.id)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="outline" className="mt-4" asChild>
                  <Link href={`/employees/${id}/salary-history`}>View Full History</Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </RoleGate>
  );
}
