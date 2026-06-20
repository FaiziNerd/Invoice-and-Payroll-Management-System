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

export function getCurrentCompanyId(): string {
  if (typeof window === "undefined") return DEFAULT_COMPANY_ID;
  try {
    const raw = localStorage.getItem(getStorageKey("current_company"));
    if (!raw) return DEFAULT_COMPANY_ID;
    return JSON.parse(raw) as string;
  } catch {
    return DEFAULT_COMPANY_ID;
  }
}

export function setCurrentCompanyId(companyId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(getStorageKey("current_company"), JSON.stringify(companyId));
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
  try {
    const raw = localStorage.getItem(getStorageKey(resolveKey(key, companyId)));
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setInStorage<T>(key: string, value: T, companyId?: string): void {
  if (typeof window === "undefined") return;
  const resolved = resolveKey(key, companyId);
  localStorage.setItem(getStorageKey(resolved), JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("ipms-storage-change", { detail: { key } }));
}

export function removeFromStorage(key: string, companyId?: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(getStorageKey(resolveKey(key, companyId)));
  window.dispatchEvent(new CustomEvent("ipms-storage-change", { detail: { key } }));
}
