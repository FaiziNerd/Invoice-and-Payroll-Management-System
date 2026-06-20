"use client";

import { use } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getEmployeeById,
  calculateGrossPay,
  calculateTotalDeductions,
  calculateNetPay,
} from "@/lib/mock-db/employees";
import { getDepartmentById } from "@/lib/mock-db/departments";
import { getSlipsByEmployeeId } from "@/lib/mock-db/salary-slips";
import { formatCurrency, formatDate } from "@/lib/utils";
import { RoleGate } from "@/components/auth/role-gate";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const employee = getEmployeeById(id);

  if (!employee) {
    return <p className="text-center py-20 text-muted-foreground">Employee not found</p>;
  }

  const dept = getDepartmentById(employee.departmentId);
  const { salaryStructure } = employee;
  const gross = calculateGrossPay(salaryStructure);
  const deductions = calculateTotalDeductions(salaryStructure);
  const net = calculateNetPay(salaryStructure);
  const slips = getSlipsByEmployeeId(id);

  return (
    <RoleGate roles={["admin", "hr"]}>
      <div className="space-y-6">
        <PageHeader
          title={`${employee.firstName} ${employee.lastName}`}
          description={`${employee.position} · ${dept?.name}`}
        >
          <Badge variant={employee.status === "active" ? "success" : "secondary"}>
            {employee.status}
          </Badge>
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
                <CardContent><p className="text-2xl font-bold text-emerald-600">{formatCurrency(net)}</p></CardContent>
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
                  <p className="text-muted-foreground text-center py-4">No salary history yet.</p>
                ) : (
                  <div className="space-y-3">
                    {slips.map((slip) => (
                      <div key={slip.id} className="flex justify-between items-center border-b pb-3">
                        <span>{MONTHS[slip.month - 1]} {slip.year}</span>
                        <span className="font-medium">{formatCurrency(slip.netPay)}</span>
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
