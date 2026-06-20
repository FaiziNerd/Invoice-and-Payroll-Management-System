import type { Company } from "@/types";
import {
  getCurrentCompanyId,
  getFromStorage,
  setCurrentCompanyId as setStoredCompanyId,
  setInStorage,
} from "./storage";
import { addAuditLog } from "@/lib/audit";

const KEY = "companies";

export const SEED_COMPANIES: Company[] = [
  {
    id: "company-dotcode",
    name: "DotCode Solutions",
    slug: "dotcode",
    createdAt: new Date().toISOString(),
  },
  {
    id: "company-acme",
    name: "Acme Holdings",
    slug: "acme",
    createdAt: new Date().toISOString(),
  },
];

export function getCompanies(): Company[] {
  return getFromStorage<Company[]>(KEY, SEED_COMPANIES);
}

export function getCompanyById(id: string): Company | undefined {
  return getCompanies().find((c) => c.id === id);
}

export function getActiveCompany(): Company {
  const id = getCurrentCompanyId();
  return getCompanyById(id) ?? SEED_COMPANIES[0];
}

export function switchCompany(
  companyId: string,
  userId: string,
  userName: string
): Company | null {
  const company = getCompanyById(companyId);
  if (!company) return null;

  const previousId = getCurrentCompanyId();
  if (previousId === companyId) return company;

  setStoredCompanyId(companyId);
  addAuditLog({
    action: "update",
    entity: "company",
    entityId: companyId,
    userId,
    userName,
    description: `Switched company from ${getCompanyById(previousId)?.name ?? previousId} to ${company.name}`,
    metadata: { previousCompanyId: previousId, companyId },
  });
  return company;
}

export function seedCompanies(): void {
  setInStorage(KEY, SEED_COMPANIES);
}
