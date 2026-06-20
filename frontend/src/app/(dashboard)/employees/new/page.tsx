"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
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
import { getDepartments } from "@/lib/mock-db/departments";
import { createEmployee } from "@/lib/mock-db/employees";
import { useAuth } from "@/providers/auth-provider";
import { generateId } from "@/lib/utils";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";
import { RoleGate } from "@/components/auth/role-gate";

type FieldErrors = {
  firstName?: string;
  lastName?: string;
  email?: string;
  departmentId?: string;
};

export default function NewEmployeePage() {
  const router = useRouter();
  const { session } = useAuth();
  const departments = getDepartments();

  const [form, setForm] = useState({
    employeeId: `EMP-${String(getDepartments().length + 4).padStart(3, "0")}`,
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    departmentId: "",
    position: "",
    joinDate: new Date().toISOString().split("T")[0],
    baseSalary: 5000,
  });

  const [allowances, setAllowances] = useState([{ id: generateId(), name: "HRA", amount: 500 }]);
  const [deductions, setDeductions] = useState([{ id: generateId(), name: "Tax", amount: 800 }]);
  const [errors, setErrors] = useState<FieldErrors>({});

  const validate = (): FieldErrors => {
    const errs: FieldErrors = {};
    if (!form.firstName.trim()) errs.firstName = "First name is required";
    if (!form.lastName.trim()) errs.lastName = "Last name is required";
    if (!form.email.trim()) errs.email = "Email is required";
    if (!form.departmentId) errs.departmentId = "Department is required";
    return errs;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    const emp = createEmployee(
      {
        ...form,
        joinDate: new Date(form.joinDate).toISOString(),
        status: "active",
        salaryStructure: { baseSalary: form.baseSalary, allowances, deductions },
      },
      session.userId,
      session.name
    );
    toast.success("Employee created");
    router.push(`/employees/${emp.id}`);
  };

  const clearError = (field: keyof FieldErrors) => {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  return (
    <RoleGate roles={["admin", "hr"]}>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Employees", href: "/employees" },
            { label: "New Employee" },
          ]}
        />
        <PageHeader title="Add Employee" description="Create a new employee profile" />

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Personal Info</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="emp-id">Employee ID</Label>
                <Input
                  id="emp-id"
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emp-dept">Department <span className="text-destructive">*</span></Label>
                <Select
                  value={form.departmentId}
                  onValueChange={(v) => { setForm({ ...form, departmentId: v }); clearError("departmentId"); }}
                >
                  <SelectTrigger
                    id="emp-dept"
                    className={errors.departmentId ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.departmentId && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <X className="h-3 w-3" />{errors.departmentId}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="emp-fname">First Name <span className="text-destructive">*</span></Label>
                <Input
                  id="emp-fname"
                  value={form.firstName}
                  onChange={(e) => { setForm({ ...form, firstName: e.target.value }); clearError("firstName"); }}
                  className={errors.firstName ? "border-destructive" : ""}
                />
                {errors.firstName && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <X className="h-3 w-3" />{errors.firstName}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="emp-lname">Last Name <span className="text-destructive">*</span></Label>
                <Input
                  id="emp-lname"
                  value={form.lastName}
                  onChange={(e) => { setForm({ ...form, lastName: e.target.value }); clearError("lastName"); }}
                  className={errors.lastName ? "border-destructive" : ""}
                />
                {errors.lastName && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <X className="h-3 w-3" />{errors.lastName}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="emp-email">Email <span className="text-destructive">*</span></Label>
                <Input
                  id="emp-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => { setForm({ ...form, email: e.target.value }); clearError("email"); }}
                  className={errors.email ? "border-destructive" : ""}
                />
                {errors.email && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <X className="h-3 w-3" />{errors.email}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="emp-phone">Phone</Label>
                <Input
                  id="emp-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emp-pos">Position</Label>
                <Input
                  id="emp-pos"
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emp-join">Join Date</Label>
                <Input
                  id="emp-join"
                  type="date"
                  value={form.joinDate}
                  onChange={(e) => setForm({ ...form, joinDate: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Salary Structure</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="emp-base-salary">Base Salary</Label>
                <Input
                  id="emp-base-salary"
                  type="number"
                  value={form.baseSalary}
                  onChange={(e) => setForm({ ...form, baseSalary: Number(e.target.value) })}
                />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <Label>Allowances</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAllowances([...allowances, { id: generateId(), name: "", amount: 0 }])}
                  >
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                </div>
                {allowances.map((a, i) => (
                  <div key={a.id} className="flex gap-2 mb-2">
                    <Input
                      placeholder="Name"
                      value={a.name}
                      onChange={(e) => { const u = [...allowances]; u[i].name = e.target.value; setAllowances(u); }}
                    />
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={a.amount}
                      onChange={(e) => { const u = [...allowances]; u[i].amount = Number(e.target.value); setAllowances(u); }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove allowance"
                      onClick={() => setAllowances(allowances.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <Label>Deductions</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDeductions([...deductions, { id: generateId(), name: "", amount: 0 }])}
                  >
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                </div>
                {deductions.map((d, i) => (
                  <div key={d.id} className="flex gap-2 mb-2">
                    <Input
                      placeholder="Name"
                      value={d.name}
                      onChange={(e) => { const u = [...deductions]; u[i].name = e.target.value; setDeductions(u); }}
                    />
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={d.amount}
                      onChange={(e) => { const u = [...deductions]; u[i].amount = Number(e.target.value); setDeductions(u); }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove deduction"
                      onClick={() => setDeductions(deductions.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit">Create Employee</Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          </div>
        </form>
      </div>
    </RoleGate>
  );
}
