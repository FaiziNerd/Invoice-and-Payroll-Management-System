import type { PayrollEntry, PayrollRun } from "@/types";
import { apiGet, apiPatch, apiPost } from "@/lib/api/fetch";
import { notifyDataChange } from "@/lib/data/events";
import type { PaginatedResponse } from "@/lib/api/pagination";

type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

let payrollCache: PayrollRun[] = [];

async function parseApi<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiResult<T>;
  if (!json.success) {
    throw new Error(json.error?.message ?? "Request failed");
  }
  return json.data;
}

async function fetchAllPayrollRuns(): Promise<PayrollRun[]> {
  const all: PayrollRun[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({ limit: "50" });
    if (cursor) params.set("cursor", cursor);
    const res = await fetch(`/api/payroll?${params.toString()}`, {
      credentials: "include",
    });
    if (!res.ok) break;
    const pageData = await parseApi<PaginatedResponse<PayrollRun>>(res);
    all.push(...pageData.items);
    if (!pageData.hasMore || !pageData.nextCursor) break;
    cursor = pageData.nextCursor;
  }

  return all;
}

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
    payrollCache = await fetchAllPayrollRuns();
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
