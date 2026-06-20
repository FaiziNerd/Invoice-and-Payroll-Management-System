import { getFromStorage, setInStorage } from "@/lib/mock-db/storage";
import type { AuditLog } from "@/types";
import { generateId } from "@/lib/utils";

const KEY = "audit_logs";

export function getAuditLogs(): AuditLog[] {
  return getFromStorage<AuditLog[]>(KEY, []);
}

export function addAuditLog(
  log: Omit<AuditLog, "id" | "timestamp">
): AuditLog {
  const entry: AuditLog = {
    ...log,
    id: generateId(),
    timestamp: new Date().toISOString(),
  };
  const logs = getAuditLogs();
  logs.unshift(entry);
  setInStorage(KEY, logs.slice(0, 500));
  return entry;
}
