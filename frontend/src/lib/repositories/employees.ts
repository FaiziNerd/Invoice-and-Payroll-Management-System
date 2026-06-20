import type { Employee, SalaryStructure } from "@/types";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/fetch";
import { notifyDataChange } from "@/lib/data/events";

let employeesCache: Employee[] = [];

function upsertCache(employee: Employee): void {
  const index = employeesCache.findIndex((e) => e.id === employee.id);
  if (index === -1) {
    employeesCache = [...employeesCache, employee];
  } else {
    employeesCache = employeesCache.map((e) => (e.id === employee.id ? employee : e));
  }
}

function removeFromCache(id: string): void {
  employeesCache = employeesCache.filter((e) => e.id !== id);
}

export async function loadEmployeesFromApi(): Promise<Employee[]> {
  try {
    employeesCache = await apiGet<Employee[]>("/api/employees");
  } catch {
    employeesCache = [];
  }
  return employeesCache;
}

export function getEmployees(): Employee[] {
  return employeesCache;
}

export function getEmployeeById(id: string): Employee | undefined {
  return employeesCache.find((e) => e.id === id);
}

export async function fetchEmployeeById(id: string): Promise<Employee | undefined> {
  const cached = getEmployeeById(id);
  if (cached) return cached;
  try {
    const employee = await apiGet<Employee>(`/api/employees/${id}`);
    upsertCache(employee);
    return employee;
  } catch {
    return undefined;
  }
}

export function getActiveEmployees(): Employee[] {
  return employeesCache.filter((e) => e.status === "active");
}

export async function createEmployee(
  data: Omit<Employee, "id" | "createdAt">,
  _userId: string,
  _userName: string
): Promise<Employee> {
  const employee = await apiPost<Employee>("/api/employees", data);
  upsertCache(employee);
  notifyDataChange("employees");
  return employee;
}

export async function updateEmployee(
  id: string,
  data: Partial<Omit<Employee, "id" | "createdAt">>,
  _userId: string,
  _userName: string
): Promise<Employee | null> {
  try {
    const employee = await apiPatch<Employee>(`/api/employees/${id}`, data);
    upsertCache(employee);
    notifyDataChange("employees");
    return employee;
  } catch {
    return null;
  }
}

export async function deleteEmployee(
  id: string,
  _userId: string,
  _userName: string
): Promise<boolean> {
  await apiDelete<{ deleted: true }>(`/api/employees/${id}`);
  removeFromCache(id);
  notifyDataChange("employees");
  return true;
}

export function calculateGrossPay(structure: SalaryStructure): number {
  const allowances = structure.allowances.reduce((sum, a) => sum + a.amount, 0);
  return structure.baseSalary + allowances;
}

export function calculateTotalDeductions(structure: SalaryStructure): number {
  return structure.deductions.reduce((sum, d) => sum + d.amount, 0);
}

export function calculateNetPay(structure: SalaryStructure): number {
  return calculateGrossPay(structure) - calculateTotalDeductions(structure);
}
