"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, FileText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSalarySlips } from "@/lib/mock-db/salary-slips";
import { getPayrollRuns } from "@/lib/mock-db/payroll";
import { getEmployeeById } from "@/lib/mock-db/employees";
import { formatCurrency } from "@/lib/utils";
import { RoleGate } from "@/components/auth/role-gate";
import { PayrollStatusBadge } from "@/components/shared/status-badge";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function SalarySlipsPage() {
  const [search, setSearch] = useState("");
  const slips = getSalarySlips();
  const runs = getPayrollRuns().filter((r) => r.status === "processed" || r.status === "paid");

  const filteredSlips = slips.filter((slip) => {
    const emp = getEmployeeById(slip.employeeId);
    if (!emp) return false;
    const name = `${emp.firstName} ${emp.lastName}`.toLowerCase();
    return name.includes(search.toLowerCase()) || emp.employeeId.toLowerCase().includes(search.toLowerCase());
  });

  const runsWithoutSlips = runs.filter((r) => !slips.some((s) => s.payrollRunId === r.id));

  return (
    <RoleGate roles={["admin", "hr"]}>
      <div className="space-y-6">
        <PageHeader title="Salary Slips" description="Generate and download employee salary slips" />

        {runsWithoutSlips.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-medium mb-3">Payroll runs ready for slip generation:</p>
              <div className="flex flex-wrap gap-2">
                {runsWithoutSlips.map((run) => (
                  <Link
                    key={run.id}
                    href={`/salary-slips/${run.id}`}
                    className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-accent"
                  >
                    <FileText className="h-4 w-4" />
                    {MONTHS[run.month - 1]} {run.year}
                    <PayrollStatusBadge status={run.status} />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by employee name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Card>
          <CardContent className="pt-6">
            {filteredSlips.length === 0 && runsWithoutSlips.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No salary slips yet. Process a payroll run first, then generate slips.
              </p>
            ) : filteredSlips.length > 0 ? (
              <div className="space-y-3">
                {filteredSlips.map((slip) => {
                  const emp = getEmployeeById(slip.employeeId);
                  return (
                    <Link
                      key={slip.id}
                      href={`/salary-slips/${slip.payrollRunId}`}
                      className="flex justify-between items-center rounded-lg border p-4 hover:bg-accent transition-colors"
                    >
                      <div>
                        <p className="font-medium">{emp ? `${emp.firstName} ${emp.lastName}` : "Unknown"}</p>
                        <p className="text-sm text-muted-foreground">
                          {emp?.employeeId} · {MONTHS[slip.month - 1]} {slip.year}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-emerald-600">{formatCurrency(slip.netPay)}</p>
                        <Badge variant="outline" className="text-xs">Generated</Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">No slips match your search.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleGate>
  );
}
