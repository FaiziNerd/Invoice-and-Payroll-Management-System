import type { PayrollRun, SalarySlip } from "@/types";
import { apiGet, apiPost } from "@/lib/api/fetch";
import { notifyDataChange } from "@/lib/data/events";

let slipsCache: SalarySlip[] = [];

export async function loadSalarySlipsFromApi(): Promise<SalarySlip[]> {
  try {
    slipsCache = await apiGet<SalarySlip[]>("/api/salary-slips");
  } catch {
    slipsCache = [];
  }
  return slipsCache;
}

export function getSalarySlips(): SalarySlip[] {
  return slipsCache;
}

export function getSlipsByRunId(runId: string): SalarySlip[] {
  return slipsCache.filter((s) => s.payrollRunId === runId);
}

export function getSlipsByEmployeeId(employeeId: string): SalarySlip[] {
  return slipsCache
    .filter((s) => s.employeeId === employeeId)
    .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
}

export function getSalarySlipById(id: string): SalarySlip | undefined {
  return slipsCache.find((s) => s.id === id);
}

export async function fetchSlipsByRunId(runId: string): Promise<SalarySlip[]> {
  try {
    const slips = await apiGet<SalarySlip[]>(
      `/api/salary-slips?runId=${encodeURIComponent(runId)}`
    );
    const other = slipsCache.filter((s) => s.payrollRunId !== runId);
    slipsCache = [...other, ...slips];
    return slips;
  } catch {
    return getSlipsByRunId(runId);
  }
}

export async function generateSlipsForRun(
  run: PayrollRun,
  _userId: string,
  _userName: string
): Promise<SalarySlip[]> {
  const slips = await apiPost<SalarySlip[]>("/api/salary-slips/generate", {
    runId: run.id,
  });
  const other = slipsCache.filter((s) => s.payrollRunId !== run.id);
  slipsCache = [...other, ...slips];
  notifyDataChange("salary_slips");
  return slips;
}
