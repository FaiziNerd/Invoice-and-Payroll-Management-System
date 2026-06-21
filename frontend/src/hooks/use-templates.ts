"use client";

import { useCallback, useEffect, useState } from "react";
import { DATA_CHANGE_EVENT } from "@/lib/data/events";
import { COMPANY_CHANGE_EVENT } from "@/lib/company/context";
import { SESSION_REFRESH_EVENT } from "@/lib/auth/client";
import { useCompanyDataReady } from "@/hooks/use-storage-data";
import type { InvoiceTemplate } from "@/types";
import { getTemplates, loadTemplatesFromApi } from "@/lib/repositories/templates";

export function useTemplates(options?: { trash?: boolean }) {
  const companyReady = useCompanyDataReady();
  const trash = options?.trash ?? false;
  const [templates, setTemplates] = useState<InvoiceTemplate[]>(() => getTemplates());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    await loadTemplatesFromApi(trash);
    setTemplates(getTemplates());
  }, [trash]);

  useEffect(() => {
    if (!companyReady) {
      setLoading(true);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void loadTemplatesFromApi(trash)
      .then(() => {
        if (!cancelled) setTemplates(getTemplates());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyReady, trash]);

  useEffect(() => {
    const sync = () => setTemplates(getTemplates());
    window.addEventListener(DATA_CHANGE_EVENT, sync);
    window.addEventListener(COMPANY_CHANGE_EVENT, sync);
    window.addEventListener(SESSION_REFRESH_EVENT, sync);
    return () => {
      window.removeEventListener(DATA_CHANGE_EVENT, sync);
      window.removeEventListener(COMPANY_CHANGE_EVENT, sync);
      window.removeEventListener(SESSION_REFRESH_EVENT, sync);
    };
  }, []);

  return { templates, loading, reload };
}

export function useActiveTemplates() {
  const { templates, loading, reload } = useTemplates();
  return {
    templates: templates.filter((t) => t.isActive),
    loading,
    reload,
  };
}
