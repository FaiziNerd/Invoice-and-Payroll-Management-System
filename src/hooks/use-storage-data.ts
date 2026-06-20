"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

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
    return () => window.removeEventListener(STORAGE_CHANGE_EVENT, onStorageChange);
  }, [storageKeys, bump]);

  useEffect(() => {
    bump();
  }, [pathname, bump]);

  return getter();
}
