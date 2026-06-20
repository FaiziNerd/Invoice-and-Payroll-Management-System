"use client";

import { use } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getEmployeeById } from "@/lib/mock-db/employees";
import { getSlipsByEmployeeId } from "@/lib/mock-db/salary-slips";
import { useStorageData } from "@/hooks/use-storage-data";
import { formatCurrency } from "@/lib/utils";
import { RoleGate } from "@/components/auth/role-gate";
import { toast } from "sonner";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function SalaryHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const employee = useStorageData(() => getEmployeeById(id), ["employees"]);
  const slips = useStorageData(() => getSlipsByEmployeeId(id), ["salary_slips"]);

  const handleDownload = async (slipId: string) => {
    const slip = slips.find((s) => s.id === slipId);
    if (!slip || !employee) return;
    try {
      const { downloadSalarySlipPDF } = await import("@/lib/pdf/salary-slip-pdf");
      await downloadSalarySlipPDF(slip, employee);
      toast.success("Salary slip downloaded");
    } catch {
      toast.error("Failed to download salary slip");
    }
  };

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
              <EmptyState
                icon="file"
                title="No salary records found"
                description="Salary slips will appear here after payroll is processed."
              />
            ) : (
              <div className="space-y-4">
                {slips.map((slip) => (
                  <div key={slip.id} className="rounded-lg border p-4">
                    <div className="flex justify-between items-center gap-4">
                      <div>
                        <p className="font-medium">{MONTHS[slip.month - 1]} {slip.year}</p>
                        <p className="text-sm text-muted-foreground">
                          Gross: {formatCurrency(slip.grossPay)} · Deductions: {formatCurrency(slip.totalDeductions)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-lg font-bold text-emerald-600">{formatCurrency(slip.netPay)}</p>
                        <Button variant="outline" size="sm" onClick={() => handleDownload(slip.id)}>
                          <Download className="h-4 w-4" /> PDF
                        </Button>
                      </div>
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
