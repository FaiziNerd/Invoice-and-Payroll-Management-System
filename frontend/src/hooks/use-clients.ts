"use client";

import { useCallback, useEffect, useState } from "react";
import { getClients } from "@/lib/repositories/clients";
import { DATA_CHANGE_EVENT } from "@/lib/data/events";
import { COMPANY_CHANGE_EVENT } from "@/lib/company/context";
import { SESSION_REFRESH_EVENT } from "@/lib/auth/client";
import { useCompanyDataReady } from "@/hooks/use-storage-data";
import type { Client } from "@/types";

export function useClients() {
  const companyReady = useCompanyDataReady();
  const [clients, setClients] = useState<Client[]>(() => getClients());

  const syncFromCache = useCallback(() => {
    setClients(getClients());
  }, []);

  useEffect(() => {
    syncFromCache();
    const onChange = () => {
      syncFromCache();
    };
    window.addEventListener(DATA_CHANGE_EVENT, onChange);
    window.addEventListener(COMPANY_CHANGE_EVENT, onChange);
    window.addEventListener(SESSION_REFRESH_EVENT, onChange);
    return () => {
      window.removeEventListener(DATA_CHANGE_EVENT, onChange);
      window.removeEventListener(COMPANY_CHANGE_EVENT, onChange);
      window.removeEventListener(SESSION_REFRESH_EVENT, onChange);
    };
  }, [syncFromCache]);

  return { clients, isLoading: !companyReady, reload: syncFromCache };
}
