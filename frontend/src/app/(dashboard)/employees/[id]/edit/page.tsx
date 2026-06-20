"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getDepartments } from "@/lib/repositories/departments";
import { getEmployeeById, updateEmployee, deleteEmployee } from "@/lib/repositories/employees";
import { useStorageData, useCompanyDataReady } from "@/hooks/use-storage-data";
import { CardGridSkeleton } from "@/components/shared/skeletons";
import { useAuth } from "@/providers/auth-provider";
import { generateId } from "@/lib/utils";
import { toast } from "sonner";
import { RoleGate } from "@/components/auth/role-gate";
import type { SalaryAllowance, SalaryDeduction } from "@/types";

export default function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { session } = useAuth();
  const dataReady = useCompanyDataReady();
  const employee = useStorageData(() => getEmployeeById(id), ["employees"]);
  const departments = useStorageData(() => getDepartments(), ["departments"]);
  const [showDelete, setShowDelete] = useState(false);

  const [form, setForm] = useState(() =>
    employee
      ? {
          employeeId: employee.employeeId,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          phone: employee.phone,
          departmentId: employee.departmentId,
          position: employee.position,
          joinDate: employee.joinDate.split("T")[0],
          status: employee.status,
          baseSalary: employee.salaryStructure.baseSalary,
        }
      : null
  );
  const [allowances, setAllowances] = useState<SalaryAllowance[]>(
    () => employee?.salaryStructure.allowances || []
  );
  const [deductions, setDeductions] = useState<SalaryDeduction[]>(
    () => employee?.salaryStructure.deductions || []
  );

  if (!dataReady) {
    return <RoleGate roles={["admin", "hr"]}><CardGridSkeleton count={3} /></RoleGate>;
  }

  if (!employee || !form) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !form.departmentId) {
      toast.error("Please fill required fields");
      return;
    }
    const result = await updateEmployee(
      id,
      {
        ...form,
        joinDate: new Date(form.joinDate).toISOString(),
        salaryStructure: { baseSalary: form.baseSalary, allowances, deductions },
      },
      session.userId,
      session.name
    );
    if (!result) {
      toast.error("Failed to update employee");
      return;
    }
    toast.success("Employee updated");
    router.push(`/employees/${id}`);
  };

  const handleDelete = async () => {
    if (!session) return;
    try {
      await deleteEmployee(id, session.userId, session.name);
      toast.success("Employee deleted");
      router.push("/employees");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete employee");
    }
  };

  return (
    <RoleGate roles={["admin", "hr"]}>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Employees", href: "/employees" },
            { label: `${employee.firstName} ${employee.lastName}`, href: `/employees/${id}` },
            { label: "Edit" },
          ]}
        />
        <PageHeader title={`Edit ${employee.firstName} ${employee.lastName}`} description="Update employee profile and salary">
          <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </PageHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Personal Info</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-emp-id">Employee ID</Label>
                <Input id="edit-emp-id" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-emp-dept">Department</Label>
                <Select value={form.departmentId} onValueChange={(v) => setForm({ ...form, departmentId: v })}>
                  <SelectTrigger id="edit-emp-dept"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-emp-fname">First Name</Label>
                <Input id="edit-emp-fname" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-emp-lname">Last Name</Label>
                <Input id="edit-emp-lname" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-emp-email">Email</Label>
                <Input id="edit-emp-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-emp-phone">Phone</Label>
                <Input id="edit-emp-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-emp-pos">Position</Label>
                <Input id="edit-emp-pos" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-emp-join">Join Date</Label>
                <Input id="edit-emp-join" type="date" value={form.joinDate} onChange={(e) => setForm({ ...form, joinDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-emp-status">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as "active" | "inactive" })}>
                  <SelectTrigger id="edit-emp-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Salary Structure</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-emp-base-salary">Base Salary</Label>
                <Input id="edit-emp-base-salary" type="number" value={form.baseSalary} onChange={(e) => setForm({ ...form, baseSalary: Number(e.target.value) })} />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <Label>Allowances</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setAllowances([...allowances, { id: generateId(), name: "", amount: 0 }])}>
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                </div>
                {allowances.map((a, i) => (
                  <div key={a.id} className="flex gap-2 mb-2">
                    <Input placeholder="Name" value={a.name} onChange={(e) => { const u = [...allowances]; u[i].name = e.target.value; setAllowances(u); }} />
                    <Input type="number" value={a.amount} onChange={(e) => { const u = [...allowances]; u[i].amount = Number(e.target.value); setAllowances(u); }} />
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove allowance" onClick={() => setAllowances(allowances.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <Label>Deductions</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setDeductions([...deductions, { id: generateId(), name: "", amount: 0 }])}>
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                </div>
                {deductions.map((d, i) => (
                  <div key={d.id} className="flex gap-2 mb-2">
                    <Input placeholder="Name" value={d.name} onChange={(e) => { const u = [...deductions]; u[i].name = e.target.value; setDeductions(u); }} />
                    <Input type="number" value={d.amount} onChange={(e) => { const u = [...deductions]; u[i].amount = Number(e.target.value); setDeductions(u); }} />
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove deduction" onClick={() => setDeductions(deductions.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit">Save Changes</Button>
            <Button type="button" variant="outline" asChild><Link href={`/employees/${id}`}>Cancel</Link></Button>
          </div>
        </form>

        <Dialog open={showDelete} onOpenChange={setShowDelete}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Employee</DialogTitle>
              <DialogDescription>Delete {employee.firstName} {employee.lastName}? This cannot be undone.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGate>
  );
}
