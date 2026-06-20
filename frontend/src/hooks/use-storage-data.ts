"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { COMPANY_CHANGE_EVENT } from "@/lib/mock-db/storage";

export const STORAGE_CHANGE_EVENT = "ipms-storage-change";

export function notifyStorageChange(key?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STORAGE_CHANGE_EVENT, { detail: { key } }));
}

function sendDiagLog(type: string, message: string) {
  if (typeof window !== "undefined") {
    fetch("http://localhost:3001/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, message }),
    }).catch(() => {});
  }
}

export function useStorageData<T>(
  getter: () => T,
  storageKeys?: string[]
): T {
  const pathname = usePathname();
  const [, setVersion] = useState(0);

  const bump = useCallback(() => {
    sendDiagLog("hook", `useStorageData bump triggered`);
    setVersion((v) => v + 1);
  }, []);

  const storageKeysStr = storageKeys?.join(",") || "";

  useEffect(() => {
    const onStorageChange = (event: Event) => {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key;
      const keys = storageKeysStr ? storageKeysStr.split(",") : null;
      if (!keys || !key || keys.includes(key)) {
        sendDiagLog("hook-event", `Storage key changed: ${key}`);
        bump();
      }
    };

    window.addEventListener(STORAGE_CHANGE_EVENT, onStorageChange);
    window.addEventListener(COMPANY_CHANGE_EVENT, bump);
    return () => {
      window.removeEventListener(STORAGE_CHANGE_EVENT, onStorageChange);
      window.removeEventListener(COMPANY_CHANGE_EVENT, bump);
    };
  }, [storageKeysStr, bump]);

  useEffect(() => {
    bump();
  }, [pathname, bump]);

  sendDiagLog("hook-read", `useStorageData reading current value for keys: ${storageKeys?.join(", ") || 'all'}`);
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
