import { getFromStorage, setInStorage } from "./storage";
import type { PayrollRun, PayrollEntry } from "@/types";
import { generateId } from "@/lib/utils";
import { addAuditLog } from "@/lib/audit";
import { getActiveEmployees } from "./employees";

const KEY = "payroll_runs";

function calculateEntry(
  employeeId: string,
  baseSalary: number,
  allowances: PayrollEntry["allowances"],
  deductions: PayrollEntry["deductions"],
  bonus = 0,
  oneOffDeduction = 0
): PayrollEntry {
  const allowanceTotal = allowances.reduce((s, a) => s + a.amount, 0);
  const deductionTotal = deductions.reduce((s, d) => s + d.amount, 0);
  const grossPay = baseSalary + allowanceTotal + bonus;
  const totalDeductions = deductionTotal + oneOffDeduction;
  const netPay = grossPay - totalDeductions;
  return {
    id: generateId(),
    employeeId,
    baseSalary,
    allowances,
    deductions,
    bonus,
    oneOffDeduction,
    grossPay,
    totalDeductions,
    netPay,
  };
}

export function getPayrollRuns(): PayrollRun[] {
  return getFromStorage<PayrollRun[]>(KEY, []);
}

export function getPayrollRunById(id: string): PayrollRun | undefined {
  return getPayrollRuns().find((r) => r.id === id);
}

export function getPayrollRunByMonth(
  month: number,
  year: number
): PayrollRun | undefined {
  return getPayrollRuns().find(
    (r) => r.month === month && r.year === year
  );
}

export function createPayrollRun(
  month: number,
  year: number,
  userId: string,
  userName: string
): PayrollRun | null {
  if (getPayrollRunByMonth(month, year)) return null;
  const employees = getActiveEmployees();
  const entries: PayrollEntry[] = employees.map((emp) =>
    calculateEntry(
      emp.id,
      emp.salaryStructure.baseSalary,
      emp.salaryStructure.allowances,
      emp.salaryStructure.deductions
    )
  );
  const totalGross = entries.reduce((s, e) => s + e.grossPay, 0);
  const totalNet = entries.reduce((s, e) => s + e.netPay, 0);
  const run: PayrollRun = {
    id: generateId(),
    month,
    year,
    status: "draft",
    entries,
    totalGross,
    totalNet,
    createdAt: new Date().toISOString(),
  };
  const runs = getPayrollRuns();
  runs.unshift(run);
  setInStorage(KEY, runs);
  addAuditLog({
    action: "create",
    entity: "payroll",
    entityId: run.id,
    userId,
    userName,
    description: `Created payroll run for ${month}/${year}`,
  });
  return run;
}

export function updatePayrollEntry(
  runId: string,
  entryId: string,
  updates: Partial<Pick<PayrollEntry, "bonus" | "oneOffDeduction">>,
  userId: string,
  userName: string
): PayrollRun | null {
  const runs = getPayrollRuns();
  const runIndex = runs.findIndex((r) => r.id === runId);
  if (runIndex === -1) return null;
  const run = runs[runIndex];
  const entryIndex = run.entries.findIndex((e) => e.id === entryId);
  if (entryIndex === -1) return null;
  const entry = run.entries[entryIndex];
  const updated = calculateEntry(
    entry.employeeId,
    entry.baseSalary,
    entry.allowances,
    entry.deductions,
    updates.bonus ?? entry.bonus,
    updates.oneOffDeduction ?? entry.oneOffDeduction
  );
  updated.id = entry.id;
  run.entries[entryIndex] = updated;
  run.totalGross = run.entries.reduce((s, e) => s + e.grossPay, 0);
  run.totalNet = run.entries.reduce((s, e) => s + e.netPay, 0);
  runs[runIndex] = run;
  setInStorage(KEY, runs);
  addAuditLog({
    action: "update",
    entity: "payroll",
    entityId: runId,
    userId,
    userName,
    description: `Updated payroll entry adjustments for ${run.month}/${run.year}`,
    metadata: { entryId, updates },
  });
  return run;
}

export function processPayrollRun(
  id: string,
  userId: string,
  userName: string
): PayrollRun | null {
  const runs = getPayrollRuns();
  const index = runs.findIndex((r) => r.id === id);
  if (index === -1) return null;
  runs[index] = {
    ...runs[index],
    status: "processed",
    processedAt: new Date().toISOString(),
  };
  setInStorage(KEY, runs);
  addAuditLog({
    action: "process",
    entity: "payroll",
    entityId: id,
    userId,
    userName,
    description: `Processed payroll for ${runs[index].month}/${runs[index].year}`,
  });
  return runs[index];
}

export function markPayrollPaid(
  id: string,
  userId: string,
  userName: string
): PayrollRun | null {
  const runs = getPayrollRuns();
  const index = runs.findIndex((r) => r.id === id);
  if (index === -1) return null;
  runs[index] = { ...runs[index], status: "paid" };
  setInStorage(KEY, runs);
  addAuditLog({
    action: "status_change",
    entity: "payroll",
    entityId: id,
    userId,
    userName,
    description: `Marked payroll as paid for ${runs[index].month}/${runs[index].year}`,
  });
  return runs[index];
}
