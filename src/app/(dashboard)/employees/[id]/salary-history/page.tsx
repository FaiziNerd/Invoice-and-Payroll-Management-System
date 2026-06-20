"use client";

import { use } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getEmployeeById } from "@/lib/mock-db/employees";
import { getSlipsByEmployeeId } from "@/lib/mock-db/salary-slips";
import { formatCurrency } from "@/lib/utils";
import { RoleGate } from "@/components/auth/role-gate";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function SalaryHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const employee = getEmployeeById(id);
  const slips = getSlipsByEmployeeId(id);

  if (!employee) {
    return <p className="text-center py-20">Employee not found</p>;
  }

  return (
    <RoleGate roles={["admin", "hr"]}>
      <div className="space-y-6">
        <PageHeader
          title="Salary History"
          description={`${employee.firstName} ${employee.lastName} · ${employee.employeeId}`}
        >
          <Button variant="outline" asChild>
            <Link href={`/employees/${id}`}>Back to Profile</Link>
          </Button>
        </PageHeader>

        <Card>
          <CardContent className="pt-6">
            {slips.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No salary records found.</p>
            ) : (
              <div className="space-y-4">
                {slips.map((slip) => (
                  <div key={slip.id} className="rounded-lg border p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{MONTHS[slip.month - 1]} {slip.year}</p>
                        <p className="text-sm text-muted-foreground">
                          Gross: {formatCurrency(slip.grossPay)} · Deductions: {formatCurrency(slip.totalDeductions)}
                        </p>
                      </div>
                      <p className="text-lg font-bold text-emerald-600">{formatCurrency(slip.netPay)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleGate>
  );
}
