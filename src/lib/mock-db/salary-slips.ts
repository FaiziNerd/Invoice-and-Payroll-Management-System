import { getFromStorage, setInStorage } from "./storage";
import type { SalarySlip } from "@/types";
import { generateId } from "@/lib/utils";
import { addAuditLog } from "@/lib/audit";
import type { PayrollRun } from "@/types";

const KEY = "salary_slips";

export function getSalarySlips(): SalarySlip[] {
  return getFromStorage<SalarySlip[]>(KEY, []);
}

export function getSlipsByRunId(runId: string): SalarySlip[] {
  return getSalarySlips().filter((s) => s.payrollRunId === runId);
}

export function getSlipsByEmployeeId(employeeId: string): SalarySlip[] {
  return getSalarySlips()
    .filter((s) => s.employeeId === employeeId)
    .sort(
      (a, b) =>
        new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    );
}

export function generateSlipsForRun(
  run: PayrollRun,
  userId: string,
  userName: string
): SalarySlip[] {
  const existing = getSlipsByRunId(run.id);
  if (existing.length > 0) return existing;

  const slips: SalarySlip[] = run.entries.map((entry) => ({
    id: generateId(),
    payrollRunId: run.id,
    employeeId: entry.employeeId,
    month: run.month,
    year: run.year,
    baseSalary: entry.baseSalary,
    allowances: entry.allowances,
    deductions: entry.deductions,
    bonus: entry.bonus,
    oneOffDeduction: entry.oneOffDeduction,
    grossPay: entry.grossPay,
    totalDeductions: entry.totalDeductions,
    netPay: entry.netPay,
    generatedAt: new Date().toISOString(),
  }));

  const all = getSalarySlips();
  setInStorage(KEY, [...slips, ...all]);
  addAuditLog({
    action: "create",
    entity: "salary_slip",
    entityId: run.id,
    userId,
    userName,
    description: `Generated ${slips.length} salary slips for ${run.month}/${run.year}`,
  });
  return slips;
}

export function getSalarySlipById(id: string): SalarySlip | undefined {
  return getSalarySlips().find((s) => s.id === id);
}
