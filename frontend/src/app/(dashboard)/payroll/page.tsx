"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, BarChart3, ChevronUp, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
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
import { getPayrollRuns } from "@/lib/repositories/payroll";
import { useStorageDataWithLoading } from "@/hooks/use-storage-data";
import { TableSkeleton } from "@/components/shared/skeletons";
import { PayrollStatusBadge } from "@/components/shared/status-badge";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import { formatCurrency } from "@/lib/utils";
import { RoleGate } from "@/components/auth/role-gate";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PAGE_SIZE = 10;

type SortField = "period" | "grossPay" | null;
type SortDir = "asc" | "desc";

export default function PayrollPage() {
  const { data: runs, isLoading } = useStorageDataWithLoading(() => getPayrollRuns(), ["payroll_runs"]);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(1);
  };

  const sorted = [...runs].sort((a, b) => {
    if (!sortField) return 0;
    let cmp = 0;
    if (sortField === "period") {
      cmp = a.year !== b.year ? a.year - b.year : a.month - b.month;
    } else if (sortField === "grossPay") {
      cmp = a.totalGross - b.totalGross;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

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
            {isLoading ? (
              <TableSkeleton rows={5} cols={5} />
            ) : runs.length === 0 ? (
              <EmptyState
                icon="file"
                title="No payroll runs yet"
                description="Start your first monthly payroll run to calculate and process employee salaries."
                action={
                  <Button asChild>
                    <Link href="/payroll/run"><Plus className="h-4 w-4" /> Run Payroll</Link>
                  </Button>
                }
              />
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <button
                            className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                            onClick={() => handleSort("period")}
                            aria-label={`Sort by period`}
                          >
                            Period <SortIcon field="period" />
                          </button>
                        </TableHead>
                        <TableHead>Employees</TableHead>
                        <TableHead>
                          <button
                            className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                            onClick={() => handleSort("grossPay")}
                            aria-label={`Sort by gross pay`}
                          >
                            Total Gross <SortIcon field="grossPay" />
                          </button>
                        </TableHead>
                        <TableHead>Total Net</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paged.map((run) => (
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
                  {paged.map((run) => (
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
                <DataTablePagination page={page} totalPages={totalPages} onPageChange={setPage} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleGate>
  );
}
