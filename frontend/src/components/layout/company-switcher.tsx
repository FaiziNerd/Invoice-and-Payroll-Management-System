"use client";

import { Building2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/providers/auth-provider";
import {
  getCompanies,
  getActiveCompany,
  switchCompany,
  loadCompaniesFromApi,
} from "@/lib/repositories/companies";
import { toast } from "sonner";

export function CompanySwitcher() {
  const { session } = useAuth();
  const [companies, setCompanies] = useState(() => getCompanies());
  const [activeId, setActiveId] = useState(() => getActiveCompany().id);

  useEffect(() => {
    void loadCompaniesFromApi().then((list) => {
      setCompanies(list);
      setActiveId(getActiveCompany().id);
    });
  }, [session?.companyId]);

  if (!session) {
    return null;
  }

  if (companies.length <= 1) {
    return null;
  }

  const handleChange = async (companyId: string) => {
    try {
      await switchCompany(companyId, session.userId, session.name);
      setActiveId(companyId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to switch company");
    }
  };

  return (
    <Select value={activeId} onValueChange={handleChange}>
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
