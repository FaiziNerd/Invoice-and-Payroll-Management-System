"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { COMPANY_CHANGE_EVENT } from "@/lib/company/context";
import { DATA_CHANGE_EVENT } from "@/lib/data/events";
import {
  COMPANY_DATA_LOADED_EVENT,
  COMPANY_DATA_LOADING_EVENT,
  isCompanyDataLoaded,
} from "@/lib/repositories/load-all";
import { useAuth } from "@/providers/auth-provider";

/** @deprecated Use DATA_CHANGE_EVENT — kept for existing hooks */
export const STORAGE_CHANGE_EVENT = DATA_CHANGE_EVENT;

/** @deprecated Use notifyDataChange from @/lib/data/events */
export { notifyDataChange as notifyStorageChange } from "@/lib/data/events";

export function useCompanyDataReady(): boolean {
  const { isLoading: authLoading } = useAuth();
  const [ready, setReady] = useState(() => isCompanyDataLoaded());

  useEffect(() => {
    if (isCompanyDataLoaded()) {
      setReady(true);
    }

    const onLoaded = () => setReady(true);
    const onLoading = () => setReady(false);

    window.addEventListener(COMPANY_DATA_LOADED_EVENT, onLoaded);
    window.addEventListener(COMPANY_DATA_LOADING_EVENT, onLoading);
    return () => {
      window.removeEventListener(COMPANY_DATA_LOADED_EVENT, onLoaded);
      window.removeEventListener(COMPANY_DATA_LOADING_EVENT, onLoading);
    };
  }, []);

  return !authLoading && ready;
}

export function useStorageData<T>(getter: () => T, storageKeys?: string[]): T {
  const pathname = usePathname();
  const [, setVersion] = useState(0);

  const bump = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  const storageKeysStr = storageKeys?.join(",") || "";

  useEffect(() => {
    const onDataChange = (event: Event) => {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key;
      const keys = storageKeysStr ? storageKeysStr.split(",") : null;
      if (!keys || !key || keys.includes(key)) {
        bump();
      }
    };

    window.addEventListener(DATA_CHANGE_EVENT, onDataChange);
    window.addEventListener(COMPANY_CHANGE_EVENT, bump);
    window.addEventListener(COMPANY_DATA_LOADED_EVENT, bump);
    return () => {
      window.removeEventListener(DATA_CHANGE_EVENT, onDataChange);
      window.removeEventListener(COMPANY_CHANGE_EVENT, bump);
      window.removeEventListener(COMPANY_DATA_LOADED_EVENT, bump);
    };
  }, [storageKeysStr, bump]);

  useEffect(() => {
    bump();
  }, [pathname, bump]);

  return getter();
}

export function useStorageDataWithLoading<T>(
  getter: () => T,
  storageKeys?: string[]
): { data: T; isLoading: boolean } {
  const companyReady = useCompanyDataReady();
  const data = useStorageData(getter, storageKeys);
  return { data, isLoading: !companyReady };
}
