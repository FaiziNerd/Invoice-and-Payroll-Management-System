"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Search, X } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calculateNetPay, restoreEmployee } from "@/lib/repositories/employees";
import { getDepartments } from "@/lib/repositories/departments";
import { useStorageDataWithLoading, useCompanyDataReady } from "@/hooks/use-storage-data";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { CardGridSkeleton } from "@/components/shared/skeletons";
import { formatCurrency } from "@/lib/utils";
import { RoleGate } from "@/components/auth/role-gate";
import { toast } from "sonner";
import type { Employee } from "@/types";

export default function EmployeesPage() {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [view, setView] = useState<"active" | "trash">("active");
  const companyReady = useCompanyDataReady();
  const {
    items: employees,
    loading: listLoading,
    loadingMore,
    hasMore,
    loadMore,
    refresh,
  } = usePaginatedList<Employee>("/api/employees", { trash: view === "trash" });
  const { data: departments } = useStorageDataWithLoading(() => getDepartments(), ["departments"]);
  const isLoading = !companyReady || listLoading;

  const isFiltered = search !== "" || deptFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setDeptFilter("all");
  };

  const filtered = useMemo(() => {
    return employees.filter((emp) => {
      const name = `${emp.firstName} ${emp.lastName}`.toLowerCase();
      const matchesSearch =
        name.includes(search.toLowerCase()) ||
        emp.employeeId.toLowerCase().includes(search.toLowerCase());
      const matchesDept = deptFilter === "all" || emp.departmentId === deptFilter;
      return matchesSearch && matchesDept;
    });
  }, [employees, search, deptFilter]);

  return (
    <RoleGate roles={["admin", "hr"]}>
      <div className="space-y-6">
        <PageHeader title="Employees" description="Manage employee profiles and salary structures">
          <div className="flex gap-2">
            <Button variant={view === "active" ? "default" : "outline"} onClick={() => setView("active")}>
              Active
            </Button>
            <Button variant={view === "trash" ? "default" : "outline"} onClick={() => setView("trash")}>
              Trash
            </Button>
            {view === "active" && (
              <Button asChild>
                <Link href="/employees/new"><Plus className="h-4 w-4" /> Add Employee</Link>
              </Button>
            )}
          </div>
        </PageHeader>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isFiltered && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0">
              <X className="h-4 w-4" /> Clear filters
            </Button>
          )}
        </div>

        {employees.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Showing {filtered.length} loaded {view === "trash" ? "trashed" : "active"} employees
          </p>
        )}

        {isLoading ? (
          <CardGridSkeleton count={6} />
        ) : employees.length === 0 ? (
          <EmptyState
            icon="users"
            title={view === "trash" ? "Trash is empty" : "No employees yet"}
            description={
              view === "trash"
                ? "Soft-deleted employees will appear here."
                : "Add your first employee to start managing profiles and salary structures."
            }
            action={
              view === "active" ? (
                <Button asChild>
                  <Link href="/employees/new"><Plus className="h-4 w-4" /> Add Employee</Link>
                </Button>
              ) : undefined
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="users"
            title="No matching employees"
            description="Try adjusting your search or department filter."
            action={
              isFiltered ? (
                <Button variant="outline" onClick={clearFilters}>
                  <X className="h-4 w-4" /> Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((emp) => {
                const dept = departments.find((d) => d.id === emp.departmentId);
                const netPay = calculateNetPay(emp.salaryStructure);
                if (view === "trash") {
                  return (
                    <Card key={emp.id} className="h-full">
                      <CardContent className="pt-6 space-y-3">
                        <div>
                          <p className="font-semibold">{emp.firstName} {emp.lastName}</p>
                          <p className="text-sm text-muted-foreground">{emp.employeeId}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            await restoreEmployee(emp.id);
                            toast.success("Employee restored");
                            await refresh();
                          }}
                        >
                          Restore
                        </Button>
                      </CardContent>
                    </Card>
                  );
                }
                return (
                  <Link key={emp.id} href={`/employees/${emp.id}`}>
                    <Card className="hover:bg-accent/50 transition-colors h-full">
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">{emp.firstName} {emp.lastName}</p>
                            <p className="text-sm text-muted-foreground">{emp.employeeId}</p>
                          </div>
                          <Badge variant={emp.status === "active" ? "success" : "secondary"}>
                            {emp.status}
                          </Badge>
                        </div>
                        <p className="text-sm mt-2">{emp.position}</p>
                        <p className="text-xs text-muted-foreground">{dept?.name}</p>
                        <p className="text-sm font-medium mt-3">Net: {formatCurrency(netPay)}/mo</p>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button variant="outline" onClick={() => void loadMore()} disabled={loadingMore}>
                  {loadingMore ? "Loading..." : "Load more"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </RoleGate>
  );
}
