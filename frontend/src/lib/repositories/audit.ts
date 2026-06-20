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

export async function addAuditLog(
  log: Omit<AuditLog, "id" | "timestamp">
): Promise<AuditLog> {
  const res = await fetch("/api/audit-logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(log),
  });

  const entry = await parseApi<AuditLog>(res);
  auditLogsCache = [entry, ...auditLogsCache].slice(0, 500);
  notifyDataChange("audit_logs");
  return entry;
}
