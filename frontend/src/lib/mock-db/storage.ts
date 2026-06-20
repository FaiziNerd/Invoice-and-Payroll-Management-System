const STORAGE_PREFIX = "ipms_";

export const COMPANY_CHANGE_EVENT = "ipms-company-change";
export const COMPANY_SCOPED_KEYS = new Set([
  "clients",
  "invoices",
  "departments",
  "employees",
  "payroll_runs",
  "salary_slips",
  "settings",
  "templates",
  "audit_logs",
]);

export const DEFAULT_COMPANY_ID = "company-dotcode";

export function getStorageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

function isCompanyScoped(key: string): boolean {
  return COMPANY_SCOPED_KEYS.has(key);
}

function resolveKey(key: string, companyId?: string): string {
  if (!isCompanyScoped(key)) return key;
  const cid = companyId ?? getCurrentCompanyId();
  return `${cid}__${key}`;
}

const cache = new Map<string, unknown>();

export function getCurrentCompanyId(): string {
  if (typeof window === "undefined") return DEFAULT_COMPANY_ID;
  const fullKey = getStorageKey("current_company");
  if (cache.has(fullKey)) {
    return cache.get(fullKey) as string;
  }
  try {
    const raw = localStorage.getItem(fullKey);
    if (!raw) {
      cache.set(fullKey, DEFAULT_COMPANY_ID);
      return DEFAULT_COMPANY_ID;
    }
    const parsed = JSON.parse(raw) as string;
    cache.set(fullKey, parsed);
    return parsed;
  } catch {
    cache.set(fullKey, DEFAULT_COMPANY_ID);
    return DEFAULT_COMPANY_ID;
  }
}

export function setCurrentCompanyId(companyId: string): void {
  if (typeof window === "undefined") return;
  const fullKey = getStorageKey("current_company");
  cache.set(fullKey, companyId);
  localStorage.setItem(fullKey, JSON.stringify(companyId));
  window.dispatchEvent(
    new CustomEvent(COMPANY_CHANGE_EVENT, { detail: { companyId } })
  );
  window.dispatchEvent(new CustomEvent("ipms-storage-change", { detail: { key: "current_company" } }));
}

export function getAllCompanyIds(): string[] {
  return getFromStorage<{ id: string }[]>("companies", []).map((c) => c.id);
}

export function getFromStorage<T>(key: string, fallback: T, companyId?: string): T {
  if (typeof window === "undefined") return fallback;
  const resolved = resolveKey(key, companyId);
  const fullKey = getStorageKey(resolved);
  if (cache.has(fullKey)) {
    return cache.get(fullKey) as T;
  }
  try {
    const raw = localStorage.getItem(fullKey);
    if (!raw) {
      cache.set(fullKey, fallback);
      return fallback;
    }
    const parsed = JSON.parse(raw) as T;
    cache.set(fullKey, parsed);
    return parsed;
  } catch {
    cache.set(fullKey, fallback);
    return fallback;
  }
}

export function setInStorage<T>(key: string, value: T, companyId?: string): void {
  if (typeof window === "undefined") return;
  const resolved = resolveKey(key, companyId);
  const fullKey = getStorageKey(resolved);
  cache.set(fullKey, value);
  localStorage.setItem(fullKey, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("ipms-storage-change", { detail: { key } }));
}

export function removeFromStorage(key: string, companyId?: string): void {
  if (typeof window === "undefined") return;
  const resolved = resolveKey(key, companyId);
  const fullKey = getStorageKey(resolved);
  cache.delete(fullKey);
  localStorage.removeItem(fullKey);
  window.dispatchEvent(new CustomEvent("ipms-storage-change", { detail: { key } }));
}

