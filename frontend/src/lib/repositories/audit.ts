import type { AuditLog } from "@/types";
import { notifyDataChange } from "@/lib/data/events";

type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

let auditLogsCache: AuditLog[] = [];

async function parseApi<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiResult<T>;
  if (!json.success) {
    throw new Error(json.error?.message ?? "Request failed");
  }
  return json.data;
}

export async function loadAuditLogsFromApi(
  page = 1,
  limit = 200
): Promise<AuditLog[]> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const res = await fetch(`/api/audit-logs?${params.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) {
    auditLogsCache = [];
    return auditLogsCache;
  }

  const payload = await parseApi<{
    logs: AuditLog[];
    page: number;
    limit: number;
    total: number;
  }>(res);
  auditLogsCache = payload.logs;
  notifyDataChange("audit_logs");
  return auditLogsCache;
}

export function getAuditLogs(): AuditLog[] {
  return auditLogsCache;
}

/** @deprecated Audit entries are recorded server-side only. This is a no-op. */
export async function addAuditLog(
  _log: Omit<AuditLog, "id" | "timestamp">
): Promise<void> {
  // Intentionally empty — see lib/server/record-audit-log.ts
}
