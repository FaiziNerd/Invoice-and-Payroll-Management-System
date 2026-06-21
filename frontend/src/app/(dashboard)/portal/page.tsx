"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Employee, SalarySlip } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export default function EmployeePortalPage() {
  const { session, hasRole } = useAuth();
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [salarySlips, setSalarySlips] = useState<SalarySlip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    if (session.memberStatus === "pending") {
      router.replace("/pending-approval");
      return;
    }
    if (!hasRole("employee")) {
      router.replace("/dashboard");
    }
  }, [session, hasRole, router]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/portal/me", { credentials: "include" });
        const json = await res.json();
        if (!json.success) throw new Error(json.error?.message ?? "Failed to load portal");
        setEmployee(json.data.employee);
        setSalarySlips(json.data.salarySlips ?? []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load portal");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleDownloadSlip = async (slip: SalarySlip) => {
    if (!employee) return;
    try {
      const { downloadSalarySlipPDF } = await import("@/lib/pdf/salary-slip-pdf");
      await downloadSalarySlipPDF(slip, employee);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download slip");
    }
  };

  if (loading || !employee) {
    return (
      <div className="p-6">
        <PageHeader title="Employee Portal" description="Loading your profile..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Portal"
        description="View your profile and salary slip history"
      />

      <Card>
        <CardContent className="pt-6 space-y-2">
          <h3 className="font-medium">Profile</h3>
          <p className="text-sm">
            {employee.firstName} {employee.lastName} ({employee.employeeId})
          </p>
          <p className="text-sm text-muted-foreground">{employee.email}</p>
          <p className="text-sm text-muted-foreground">{employee.position}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h3 className="mb-4 font-medium">Salary slips</h3>
          {salarySlips.length === 0 ? (
            <EmptyState
              icon="receipt"
              title="No salary slips yet"
              description="Your salary slips will appear here after payroll is processed."
              className="py-8"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Net pay</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salarySlips.map((slip) => (
                  <TableRow key={slip.id}>
                    <TableCell>
                      {slip.month}/{slip.year}
                    </TableCell>
                    <TableCell>{formatCurrency(slip.netPay)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => handleDownloadSlip(slip)}>
                        Download PDF
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
