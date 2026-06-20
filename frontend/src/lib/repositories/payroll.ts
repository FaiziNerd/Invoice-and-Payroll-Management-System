import type { PayrollEntry, PayrollRun } from "@/types";
import { apiGet, apiPatch, apiPost } from "@/lib/api/fetch";
import { notifyDataChange } from "@/lib/data/events";

let payrollCache: PayrollRun[] = [];

function upsertCache(run: PayrollRun): void {
  const index = payrollCache.findIndex((r) => r.id === run.id);
  if (index === -1) {
    payrollCache = [run, ...payrollCache];
  } else {
    payrollCache = payrollCache.map((r) => (r.id === run.id ? run : r));
  }
}

export async function loadPayrollFromApi(): Promise<PayrollRun[]> {
  try {
    payrollCache = await apiGet<PayrollRun[]>("/api/payroll");
  } catch {
    payrollCache = [];
  }
  return payrollCache;
}

export function getPayrollRuns(): PayrollRun[] {
  return payrollCache;
}

export function getPayrollRunById(id: string): PayrollRun | undefined {
  return payrollCache.find((r) => r.id === id);
}

export async function fetchPayrollRunById(id: string): Promise<PayrollRun | undefined> {
  const cached = getPayrollRunById(id);
  if (cached) return cached;
  try {
    const run = await apiGet<PayrollRun>(`/api/payroll/${id}`);
    upsertCache(run);
    return run;
  } catch {
    return undefined;
  }
}

export function getPayrollRunByMonth(month: number, year: number): PayrollRun | undefined {
  return payrollCache.find((r) => r.month === month && r.year === year);
}

export async function createPayrollRun(
  month: number,
  year: number,
  _userId: string,
  _userName: string
): Promise<PayrollRun | null> {
  try {
    const run = await apiPost<PayrollRun>("/api/payroll", { month, year });
    upsertCache(run);
    notifyDataChange("payroll_runs");
    return run;
  } catch {
    return null;
  }
}

export async function updatePayrollEntry(
  runId: string,
  entryId: string,
  updates: Partial<Pick<PayrollEntry, "bonus" | "oneOffDeduction">>,
  _userId: string,
  _userName: string
): Promise<PayrollRun | null> {
  try {
    const run = await apiPatch<PayrollRun>(
      `/api/payroll/${runId}/entries/${entryId}`,
      updates
    );
    upsertCache(run);
    notifyDataChange("payroll_runs");
    return run;
  } catch {
    return null;
  }
}

export async function processPayrollRun(
  id: string,
  _userId: string,
  _userName: string
): Promise<PayrollRun | null> {
  try {
    const run = await apiPost<PayrollRun>(`/api/payroll/${id}/process`);
    upsertCache(run);
    notifyDataChange("payroll_runs");
    return run;
  } catch {
    return null;
  }
}

export async function markPayrollPaid(
  id: string,
  _userId: string,
  _userName: string
): Promise<PayrollRun | null> {
  try {
    const run = await apiPost<PayrollRun>(`/api/payroll/${id}/paid`);
    upsertCache(run);
    notifyDataChange("payroll_runs");
    return run;
  } catch {
    return null;
  }
}
