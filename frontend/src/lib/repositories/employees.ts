import type { Employee, SalaryStructure } from "@/types";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/fetch";
import { notifyDataChange } from "@/lib/data/events";
import type { PaginatedResponse } from "@/lib/api/pagination";

type SalaryStructureInput = Omit<SalaryStructure, "allowances" | "deductions"> & {
  allowances: Array<{ name: string; amount: number }>;
  deductions: Array<{ name: string; amount: number }>;
};

type EmployeeInput = Omit<Employee, "id" | "createdAt" | "salaryStructure"> & {
  salaryStructure: SalaryStructureInput;
};

type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

let employeesCache: Employee[] = [];

async function parseApi<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiResult<T>;
  if (!json.success) {
    throw new Error(json.error?.message ?? "Request failed");
  }
  return json.data;
}

async function fetchAllActiveEmployees(): Promise<Employee[]> {
  const all: Employee[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({ limit: "100" });
    if (cursor) params.set("cursor", cursor);
    const res = await fetch(`/api/employees?${params.toString()}`, {
      credentials: "include",
    });
    if (!res.ok) break;
    const pageData = await parseApi<PaginatedResponse<Employee>>(res);
    all.push(...pageData.items);
    if (!pageData.hasMore || !pageData.nextCursor) break;
    cursor = pageData.nextCursor;
  }

  return all;
}

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
    employeesCache = await fetchAllActiveEmployees();
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
  data: EmployeeInput,
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
  data: Partial<EmployeeInput>,
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

export async function restoreEmployee(id: string): Promise<Employee> {
  const employee = await apiPatch<Employee>(`/api/employees/${id}`, { restore: true });
  upsertCache(employee);
  notifyDataChange("employees");
  return employee;
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
