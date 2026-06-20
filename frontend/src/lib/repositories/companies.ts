import type { Company } from "@/types";
import {
  getCurrentCompanyId,
  setCurrentCompanyId as setStoredCompanyId,
} from "@/lib/company/context";
import { addAuditLog } from "@/lib/repositories/audit";
import { SESSION_REFRESH_EVENT } from "@/lib/auth/client";

let companiesCache: Company[] = [];

export async function loadCompaniesFromApi(): Promise<Company[]> {
  const res = await fetch("/api/companies", { credentials: "include" });
  if (!res.ok) {
    companiesCache = [];
    return companiesCache;
  }
  const json = (await res.json()) as {
    success: boolean;
    data?: {
      companies: Array<{
        id: string;
        name: string;
        slug: string;
        createdAt: string;
      }>;
      activeCompanyId: string | null;
    };
  };
  if (!json.success || !json.data) {
    companiesCache = [];
    return companiesCache;
  }

  companiesCache = json.data.companies.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    createdAt: c.createdAt,
  }));

  if (json.data.activeCompanyId) {
    setStoredCompanyId(json.data.activeCompanyId);
  }

  return companiesCache;
}

export function getCompanies(): Company[] {
  return companiesCache;
}

export function getCompanyById(id: string): Company | undefined {
  return getCompanies().find((c) => c.id === id);
}

export function getActiveCompany(): Company {
  const id = getCurrentCompanyId();
  return getCompanyById(id) ?? companiesCache[0] ?? { id, name: "Company", slug: "", createdAt: "" };
}

export async function switchCompany(
  companyId: string,
  userId: string,
  userName: string
): Promise<Company | null> {
  const company = getCompanyById(companyId);
  if (!company) return null;

  const previousId = getCurrentCompanyId();
  if (previousId === companyId) return company;

  const res = await fetch("/api/companies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ companyId }),
  });

  const json = (await res.json()) as {
    success: boolean;
    error?: { message: string };
  };

  if (!json.success) {
    throw new Error(json.error?.message ?? "Failed to switch company");
  }

  setStoredCompanyId(companyId);
  window.dispatchEvent(new CustomEvent(SESSION_REFRESH_EVENT));

  void addAuditLog({
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

/** @deprecated Companies are loaded from Supabase via loadCompaniesFromApi */
export function seedCompanies(): void {}

export const SEED_COMPANIES: Company[] = [];
