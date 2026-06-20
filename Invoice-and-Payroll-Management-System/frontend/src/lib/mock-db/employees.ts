import { getFromStorage, setInStorage } from "./storage";
import type { Employee, PayrollRun, SalaryStructure } from "@/types";
import { generateId } from "@/lib/utils";
import { addAuditLog } from "@/lib/audit";

const KEY = "employees";
const PAYROLL_RUNS_KEY = "payroll_runs";

export function getEmployees(): Employee[] {
  return getFromStorage<Employee[]>(KEY, []);
}

export function getEmployeeById(id: string): Employee | undefined {
  return getEmployees().find((e) => e.id === id);
}

export function getActiveEmployees(): Employee[] {
  return getEmployees().filter((e) => e.status === "active");
}

export function createEmployee(
  data: Omit<Employee, "id" | "createdAt">,
  userId: string,
  userName: string
): Employee {
  const employee: Employee = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  const employees = getEmployees();
  employees.push(employee);
  setInStorage(KEY, employees);
  addAuditLog({
    action: "create",
    entity: "employee",
    entityId: employee.id,
    userId,
    userName,
    description: `Created employee ${employee.firstName} ${employee.lastName}`,
  });
  return employee;
}

export function updateEmployee(
  id: string,
  data: Partial<Omit<Employee, "id" | "createdAt">>,
  userId: string,
  userName: string
): Employee | null {
  const employees = getEmployees();
  const index = employees.findIndex((e) => e.id === id);
  if (index === -1) return null;
  employees[index] = { ...employees[index], ...data };
  setInStorage(KEY, employees);
  addAuditLog({
    action: "update",
    entity: "employee",
    entityId: id,
    userId,
    userName,
    description: `Updated employee ${employees[index].firstName} ${employees[index].lastName}`,
  });
  return employees[index];
}

export function deleteEmployee(
  id: string,
  userId: string,
  userName: string
): boolean {
  const employees = getEmployees();
  const emp = employees.find((e) => e.id === id);
  if (!emp) return false;
  if (
    getFromStorage<PayrollRun[]>(PAYROLL_RUNS_KEY, []).some((run) =>
      run.entries.some((entry) => entry.employeeId === id)
    )
  ) {
    throw new Error(
      "Cannot delete this employee because they appear in one or more payroll runs."
    );
  }
  setInStorage(
    KEY,
    employees.filter((e) => e.id !== id)
  );
  addAuditLog({
    action: "delete",
    entity: "employee",
    entityId: id,
    userId,
    userName,
    description: `Deleted employee ${emp.firstName} ${emp.lastName}`,
  });
  return true;
}

export function calculateGrossPay(structure: SalaryStructure): number {
  const allowances = structure.allowances.reduce((s, a) => s + a.amount, 0);
  return structure.baseSalary + allowances;
}

export function calculateTotalDeductions(structure: SalaryStructure): number {
  return structure.deductions.reduce((s, d) => s + d.amount, 0);
}

export function calculateNetPay(structure: SalaryStructure): number {
  return calculateGrossPay(structure) - calculateTotalDeductions(structure);
}
