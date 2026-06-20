"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getPayrollRuns } from "@/lib/mock-db/payroll";
import { PayrollStatusBadge } from "@/components/shared/status-badge";
import { formatCurrency } from "@/lib/utils";
import { RoleGate } from "@/components/auth/role-gate";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function PayrollPage() {
  const [runs, setRuns] = useState(() => getPayrollRuns());

  return (
    <RoleGate roles={["admin", "accountant", "hr"]}>
      <div className="space-y-6">
        <PageHeader title="Payroll" description="Monthly payroll processing and history">
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/payroll/reports"><BarChart3 className="h-4 w-4" /> Reports</Link>
            </Button>
            <Button asChild>
              <Link href="/payroll/run"><Plus className="h-4 w-4" /> Run Payroll</Link>
            </Button>
          </div>
        </PageHeader>

        <Card>
          <CardContent className="pt-6">
            {runs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No payroll runs yet. Start your first run.</p>
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Employees</TableHead>
                        <TableHead>Total Gross</TableHead>
                        <TableHead>Total Net</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runs.map((run) => (
                        <TableRow key={run.id}>
                          <TableCell>
                            <Link href={`/payroll/${run.id}`} className="font-medium text-primary hover:underline">
                              {MONTHS[run.month - 1]} {run.year}
                            </Link>
                          </TableCell>
                          <TableCell>{run.entries.length}</TableCell>
                          <TableCell>{formatCurrency(run.totalGross)}</TableCell>
                          <TableCell>{formatCurrency(run.totalNet)}</TableCell>
                          <TableCell><PayrollStatusBadge status={run.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="space-y-3 md:hidden">
                  {runs.map((run) => (
                    <Link key={run.id} href={`/payroll/${run.id}`} className="block rounded-lg border p-4 hover:bg-accent">
                      <div className="flex justify-between">
                        <span className="font-medium">{MONTHS[run.month - 1]} {run.year}</span>
                        <PayrollStatusBadge status={run.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">{run.entries.length} employees</p>
                      <p className="font-semibold">{formatCurrency(run.totalNet)}</p>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleGate>
  );
}
