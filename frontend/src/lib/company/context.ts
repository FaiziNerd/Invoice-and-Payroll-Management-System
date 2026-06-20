const CURRENT_COMPANY_STORAGE_KEY = "ipms_current_company";

export const COMPANY_CHANGE_EVENT = "ipms-company-change";

let currentCompanyId: string | null = null;

function normalizeStoredCompanyId(raw: string | null): string | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "string" && parsed.trim().length > 0
      ? parsed
      : null;
  } catch {
    return raw.trim().length > 0 ? raw : null;
  }
}

export function getCurrentCompanyId(): string {
  if (currentCompanyId) return currentCompanyId;
  if (typeof window === "undefined") return "";

  const stored = normalizeStoredCompanyId(
    window.localStorage.getItem(CURRENT_COMPANY_STORAGE_KEY)
  );
  currentCompanyId = stored;
  return stored ?? "";
}

export function setCurrentCompanyId(companyId: string): void {
  currentCompanyId = companyId.trim().length > 0 ? companyId : null;
  if (typeof window === "undefined") return;

  if (currentCompanyId) {
    window.localStorage.setItem(CURRENT_COMPANY_STORAGE_KEY, currentCompanyId);
  } else {
    window.localStorage.removeItem(CURRENT_COMPANY_STORAGE_KEY);
  }

  window.dispatchEvent(
    new CustomEvent(COMPANY_CHANGE_EVENT, {
      detail: { companyId: currentCompanyId },
    })
  );
}
