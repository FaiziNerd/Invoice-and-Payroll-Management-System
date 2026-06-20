const STORAGE_PREFIX = "ipms_";

export function getStorageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

export function getFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(getStorageKey(key));
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setInStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(getStorageKey(key), JSON.stringify(value));
}

export function removeFromStorage(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(getStorageKey(key));
}
