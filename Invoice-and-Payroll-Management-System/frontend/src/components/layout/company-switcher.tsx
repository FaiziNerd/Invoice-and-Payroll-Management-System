"use client";

import { Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/providers/auth-provider";
import { getCompanies, getActiveCompany, switchCompany } from "@/lib/mock-db/companies";
import { useStorageData } from "@/hooks/use-storage-data";

export function CompanySwitcher() {
  const { session, hasRole } = useAuth();
  const companies = useStorageData(() => getCompanies(), ["companies"]);
  const activeCompany = useStorageData(() => getActiveCompany(), ["current_company"]);

  if (!hasRole("admin") || !session) {
    return null;
  }

  const handleChange = (companyId: string) => {
    switchCompany(companyId, session.userId, session.name);
  };

  return (
    <Select value={activeCompany.id} onValueChange={handleChange}>
      <SelectTrigger className="h-9 w-[180px] gap-2 sm:w-[220px]">
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <SelectValue placeholder="Select company" />
      </SelectTrigger>
      <SelectContent>
        {companies.map((company) => (
          <SelectItem key={company.id} value={company.id}>
            {company.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
