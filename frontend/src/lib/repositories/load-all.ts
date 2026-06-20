import { loadAuditLogsFromApi } from "@/lib/repositories/audit";
import { loadClientsFromApi } from "@/lib/repositories/clients";
import { loadCompaniesFromApi } from "@/lib/repositories/companies";
import { loadDepartmentsFromApi } from "@/lib/repositories/departments";
import { loadEmployeesFromApi } from "@/lib/repositories/employees";
import { loadInvoicesFromApi } from "@/lib/repositories/invoices";
import { loadPayrollFromApi } from "@/lib/repositories/payroll";
import { loadSalarySlipsFromApi } from "@/lib/repositories/salary-slips";
import { loadSettingsFromApi } from "@/lib/repositories/settings";
import { loadTemplatesFromApi } from "@/lib/repositories/templates";

/** Preload all company-scoped data after login or company switch. */
export async function loadAllCompanyData(): Promise<void> {
  await Promise.all([
    loadCompaniesFromApi(),
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
}
