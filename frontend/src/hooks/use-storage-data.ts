"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { COMPANY_CHANGE_EVENT } from "@/lib/company/context";
import { DATA_CHANGE_EVENT } from "@/lib/data/events";

/** @deprecated Use DATA_CHANGE_EVENT — kept for existing hooks */
export const STORAGE_CHANGE_EVENT = DATA_CHANGE_EVENT;

/** @deprecated Use notifyDataChange from @/lib/data/events */
export { notifyDataChange as notifyStorageChange } from "@/lib/data/events";

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
    return () => {
      window.removeEventListener(DATA_CHANGE_EVENT, onDataChange);
      window.removeEventListener(COMPANY_CHANGE_EVENT, bump);
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
  const [isLoading, setIsLoading] = useState(true);
  const data = useStorageData(getter, storageKeys);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  return { data, isLoading };
}
