import type { SalaryAllowance, SalaryDeduction, SalarySlip } from "@/types";

export interface SalarySlipRow {
  id: string;
  company_id: string;
  payroll_run_id: string;
  employee_id: string;
  month: number;
  year: number;
  base_salary: number | string;
  allowances: unknown;
  deductions: unknown;
  bonus: number | string;
  one_off_deduction: number | string;
  gross_pay: number | string;
  total_deductions: number | string;
  net_pay: number | string;
  generated_at: string;
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

export function rowToSalarySlip(row: SalarySlipRow): SalarySlip {
  return {
    id: row.id,
    payrollRunId: row.payroll_run_id,
    employeeId: row.employee_id,
    month: row.month,
    year: row.year,
    baseSalary: toNumber(row.base_salary),
    allowances: normalizeSalaryItems(row.allowances) as SalaryAllowance[],
    deductions: normalizeSalaryItems(row.deductions) as SalaryDeduction[],
    bonus: toNumber(row.bonus),
    oneOffDeduction: toNumber(row.one_off_deduction),
    grossPay: toNumber(row.gross_pay),
    totalDeductions: toNumber(row.total_deductions),
    netPay: toNumber(row.net_pay),
    generatedAt: row.generated_at,
  };
}
