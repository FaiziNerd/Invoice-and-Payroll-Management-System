"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { COMPANY_CHANGE_EVENT } from "@/lib/mock-db/storage";

export const STORAGE_CHANGE_EVENT = "ipms-storage-change";

export function notifyStorageChange(key?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STORAGE_CHANGE_EVENT, { detail: { key } }));
}

export function useStorageData<T>(
  getter: () => T,
  storageKeys?: string[]
): T {
  const pathname = usePathname();
  const [, setVersion] = useState(0);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    const onStorageChange = (event: Event) => {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key;
      if (!storageKeys || !key || storageKeys.includes(key)) {
        bump();
      }
    };

    window.addEventListener(STORAGE_CHANGE_EVENT, onStorageChange);
    window.addEventListener(COMPANY_CHANGE_EVENT, bump);
    return () => {
      window.removeEventListener(STORAGE_CHANGE_EVENT, onStorageChange);
      window.removeEventListener(COMPANY_CHANGE_EVENT, bump);
    };
  }, [storageKeys, bump]);

  useEffect(() => {
    bump();
  }, [pathname, bump]);

  return getter();
}
