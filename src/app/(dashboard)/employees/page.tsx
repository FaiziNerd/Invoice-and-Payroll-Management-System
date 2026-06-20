"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
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
import {
  getEmployees,
} from "@/lib/mock-db/employees";
import { getDepartments } from "@/lib/mock-db/departments";
import { calculateNetPay } from "@/lib/mock-db/employees";
import { formatCurrency } from "@/lib/utils";
import { RoleGate } from "@/components/auth/role-gate";

export default function EmployeesPage() {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const employees = getEmployees();
  const departments = getDepartments();

  const filtered = employees.filter((emp) => {
    const name = `${emp.firstName} ${emp.lastName}`.toLowerCase();
    const matchesSearch = name.includes(search.toLowerCase()) || emp.employeeId.toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === "all" || emp.departmentId === deptFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <RoleGate roles={["admin", "hr"]}>
      <div className="space-y-6">
        <PageHeader title="Employees" description="Manage employee profiles and salary structures">
          <Button asChild>
            <Link href="/employees/new"><Plus className="h-4 w-4" /> Add Employee</Link>
          </Button>
        </PageHeader>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search employees..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((emp) => {
            const dept = departments.find((d) => d.id === emp.departmentId);
            const netPay = calculateNetPay(emp.salaryStructure);
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
      </div>
    </RoleGate>
  );
}
