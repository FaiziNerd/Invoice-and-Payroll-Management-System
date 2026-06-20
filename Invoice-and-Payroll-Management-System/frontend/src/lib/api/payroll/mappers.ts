import type { PayrollEntry, PayrollRun, SalaryAllowance, SalaryDeduction } from "@/types";

export interface PayrollEntryRow {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  base_salary: number | string;
  bonus: number | string;
  one_off_deduction: number | string;
  gross_pay: number | string;
  total_deductions: number | string;
  net_pay: number | string;
  allowances: unknown;
  deductions: unknown;
}

export interface PayrollRunRow {
  id: string;
  company_id: string;
  month: number;
  year: number;
  status: "draft" | "processed" | "paid";
  total_gross: number | string;
  total_net: number | string;
  processed_at: string | null;
  created_at: string;
  payroll_entries?: PayrollEntryRow[] | null;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim().length > 0) return Number(value);
  return 0;
}

function normalizeSalaryItems(value: unknown): Array<{ id: string; name: string; amount: number }> {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const row = item as Partial<{ id: string; name: string; amount: number | string }>;
    return {
      id: row.id ?? `snapshot-${index}`,
      name: row.name ?? "",
      amount: toNumber(row.amount),
    };
  });
}

export function rowToPayrollEntry(row: PayrollEntryRow): PayrollEntry {
  return {
    id: row.id,
    employeeId: row.employee_id,
    baseSalary: toNumber(row.base_salary),
    allowances: normalizeSalaryItems(row.allowances) as SalaryAllowance[],
    deductions: normalizeSalaryItems(row.deductions) as SalaryDeduction[],
    bonus: toNumber(row.bonus),
    oneOffDeduction: toNumber(row.one_off_deduction),
    grossPay: toNumber(row.gross_pay),
    totalDeductions: toNumber(row.total_deductions),
    netPay: toNumber(row.net_pay),
  };
}

export function rowToPayrollRun(row: PayrollRunRow): PayrollRun {
  return {
    id: row.id,
    month: row.month,
    year: row.year,
    status: row.status,
    entries: (row.payroll_entries ?? []).map(rowToPayrollEntry),
    totalGross: toNumber(row.total_gross),
    totalNet: toNumber(row.total_net),
    processedAt: row.processed_at ?? undefined,
    createdAt: row.created_at,
  };
}
