import { loadAuditLogsFromApi } from "@/lib/repositories/audit";
import { loadClientsFromApi } from "@/lib/repositories/clients";
import { loadCompaniesFromApi } from "@/lib/repositories/companies";
import { loadDepartmentsFromApi } from "@/lib/repositories/departments";
import { loadEmployeesFromApi } from "@/lib/repositories/employees";
import {
  loadInvoicesFromApi,
  resolveOverdueInvoicesFromApi,
} from "@/lib/repositories/invoices";
import { loadPayrollFromApi } from "@/lib/repositories/payroll";
import { loadSalarySlipsFromApi } from "@/lib/repositories/salary-slips";
import { loadSettingsFromApi } from "@/lib/repositories/settings";
import { loadTemplatesFromApi } from "@/lib/repositories/templates";

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

/** Preload all company-scoped data after login or company switch. */
export async function loadAllCompanyData(): Promise<void> {
  notifyCompanyDataLoading();

  try {
    // Establish company context (sets client-side active company id from session)
    await loadCompaniesFromApi();
    await resolveOverdueInvoicesFromApi();
    await Promise.all([
      loadClientsFromApi(),
      loadInvoicesFromApi(),
      loadDepartmentsFromApi(),
      loadEmployeesFromApi(),
      loadPayrollFromApi(),
      loadSalarySlipsFromApi(),
      loadTemplatesFromApi(),
      loadSettingsFromApi(),
      loadAuditLogsFromApi(),
    ]);
  } finally {
    notifyCompanyDataLoaded();
  }
}
