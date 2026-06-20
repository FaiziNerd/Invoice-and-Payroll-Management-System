import type { Employee, SalaryAllowance, SalaryDeduction } from "@/types";

export interface EmployeeAllowanceRow {
  id: string;
  employee_id: string;
  name: string;
  amount: number | string;
}

export interface EmployeeDeductionRow {
  id: string;
  employee_id: string;
  name: string;
  amount: number | string;
}

export interface EmployeeRow {
  id: string;
  company_id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  department_id: string;
  position: string | null;
  join_date: string;
  status: "active" | "inactive";
  salary_base: number | string;
  created_at: string;
  employee_allowances?: EmployeeAllowanceRow[] | null;
  employee_deductions?: EmployeeDeductionRow[] | null;
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim().length > 0) return Number(value);
  return 0;
}

function rowToAllowance(row: EmployeeAllowanceRow): SalaryAllowance {
  return {
    id: row.id,
    name: row.name,
    amount: toNumber(row.amount),
  };
}

function rowToDeduction(row: EmployeeDeductionRow): SalaryDeduction {
  return {
    id: row.id,
    name: row.name,
    amount: toNumber(row.amount),
  };
}

export function rowToEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    employeeId: row.employee_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone ?? "",
    departmentId: row.department_id,
    position: row.position ?? "",
    joinDate: row.join_date,
    status: row.status,
    salaryStructure: {
      baseSalary: toNumber(row.salary_base),
      allowances: (row.employee_allowances ?? []).map(rowToAllowance),
      deductions: (row.employee_deductions ?? []).map(rowToDeduction),
    },
    createdAt: row.created_at,
  };
}

export function employeeFieldsToRow(fields: {
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  departmentId: string;
  position: string;
  joinDate: string;
  status: "active" | "inactive";
  salaryStructure: {
    baseSalary: number;
    allowances: Array<{ name: string; amount: number }>;
    deductions: Array<{ name: string; amount: number }>;
  };
}) {
  return {
    employee_id: fields.employeeId,
    first_name: fields.firstName,
    last_name: fields.lastName,
    email: fields.email,
    phone: fields.phone || null,
    department_id: fields.departmentId,
    position: fields.position || null,
    join_date: fields.joinDate,
    status: fields.status,
    salary_base: fields.salaryStructure.baseSalary,
  };
}

export function allowanceFieldsToRows(
  employeeId: string,
  allowances: Array<{ name: string; amount: number }>
) {
  return allowances.map((allowance) => ({
    employee_id: employeeId,
    name: allowance.name,
    amount: allowance.amount,
  }));
}

export function deductionFieldsToRows(
  employeeId: string,
  deductions: Array<{ name: string; amount: number }>
) {
  return deductions.map((deduction) => ({
    employee_id: employeeId,
    name: deduction.name,
    amount: deduction.amount,
  }));
}
