import { getFromStorage, setInStorage } from "./storage";
import type { OrganizationSettings } from "@/types";
import { addAuditLog } from "@/lib/audit";

const KEY = "settings";

const DEFAULT_SETTINGS: OrganizationSettings = {
  id: "org-1",
  name: "DotCode Solutions",
  address: "123 Business Ave, Suite 100, New York, NY 10001",
  defaultTemplateId: "",
};

export function getSettings(): OrganizationSettings {
  return getFromStorage<OrganizationSettings>(KEY, DEFAULT_SETTINGS);
}

export function updateSettings(
  updates: Partial<Pick<OrganizationSettings, "name" | "address" | "defaultTemplateId">>,
  userId: string,
  userName: string
): OrganizationSettings {
  const current = getSettings();
  const updated: OrganizationSettings = { ...current, ...updates };
  setInStorage(KEY, updated);
  addAuditLog({
    action: "update",
    entity: "settings",
    entityId: updated.id,
    userId,
    userName,
    description: "Updated organization settings",
    metadata: updates,
  });
  return updated;
}

export function getOrganizationCompanyName(): string {
  return getSettings().name || "DotCode Solutions";
}

export function getOrganizationAddress(): string {
  return getSettings().address || "";
}
