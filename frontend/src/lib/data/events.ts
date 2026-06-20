export const DATA_CHANGE_EVENT = "ipms-data-change";

export function notifyDataChange(key?: string): void {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(DATA_CHANGE_EVENT, {
      detail: { key },
    })
  );
}
