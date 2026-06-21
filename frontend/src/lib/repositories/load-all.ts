import { loadClientsFromApi } from "@/lib/repositories/clients";
import { loadCompaniesFromApi } from "@/lib/repositories/companies";
import { loadDepartmentsFromApi } from "@/lib/repositories/departments";
import { resolveOverdueInvoicesFromApi } from "@/lib/repositories/invoices";
import { loadSettingsFromApi } from "@/lib/repositories/settings";

export const COMPANY_DATA_LOADING_EVENT = "company-data-loading";
export const COMPANY_DATA_LOADED_EVENT = "company-data-loaded";

let companyDataLoaded = false;

export function isCompanyDataLoaded(): boolean {
  return companyDataLoaded;
}

function notifyCompanyDataLoading(): void {
  if (typeof window === "undefined") return;
  companyDataLoaded = false;
  window.dispatchEvent(new CustomEvent(COMPANY_DATA_LOADING_EVENT));
}

function notifyCompanyDataLoaded(): void {
  if (typeof window === "undefined") return;
  companyDataLoaded = true;
  window.dispatchEvent(new CustomEvent(COMPANY_DATA_LOADED_EVENT));
}

/** Preload company-scoped data after login or company switch (non-blocking for auth UI). */
export async function loadAllCompanyData(): Promise<void> {
  notifyCompanyDataLoading();

  try {
    await Promise.all([
      loadCompaniesFromApi(),
      loadClientsFromApi(),
      loadDepartmentsFromApi(),
      loadSettingsFromApi(),
    ]);
  } finally {
    notifyCompanyDataLoaded();
    void resolveOverdueInvoicesFromApi().catch(() => {});
  }
}
