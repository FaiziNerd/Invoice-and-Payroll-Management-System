"use client";

import { useCallback, useEffect, useState } from "react";
import { getClients, loadClientsFromApi } from "@/lib/repositories/clients";
import { DATA_CHANGE_EVENT } from "@/lib/data/events";
import { COMPANY_CHANGE_EVENT } from "@/lib/company/context";
import { SESSION_REFRESH_EVENT } from "@/lib/auth/client";
import type { Client } from "@/types";

export function useClients() {
  const [clients, setClients] = useState<Client[]>(() => getClients());
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    const data = await loadClientsFromApi();
    setClients(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void reload();
    const onChange = () => {
      void reload();
    };
    window.addEventListener(DATA_CHANGE_EVENT, onChange);
    window.addEventListener(COMPANY_CHANGE_EVENT, onChange);
    window.addEventListener(SESSION_REFRESH_EVENT, onChange);
    return () => {
      window.removeEventListener(DATA_CHANGE_EVENT, onChange);
      window.removeEventListener(COMPANY_CHANGE_EVENT, onChange);
      window.removeEventListener(SESSION_REFRESH_EVENT, onChange);
    };
  }, [reload]);

  return { clients, isLoading, reload };
}
