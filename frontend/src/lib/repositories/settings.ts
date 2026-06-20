import type { OrganizationSettings } from "@/types";
import { addAuditLog } from "@/lib/audit";
import { apiGet, apiPatch } from "@/lib/api/fetch";
import { notifyDataChange } from "@/lib/data/events";

const DEFAULT_SETTINGS: OrganizationSettings = {
  id: "",
  name: "My Company",
  address: "",
  defaultTemplateId: "",
};

let settingsCache: OrganizationSettings = DEFAULT_SETTINGS;

export async function loadSettingsFromApi(): Promise<OrganizationSettings> {
  settingsCache = await apiGet<OrganizationSettings>("/api/settings");
  return settingsCache;
}

export function getSettings(): OrganizationSettings {
  return settingsCache;
}

export async function updateSettings(
  updates: Partial<Pick<OrganizationSettings, "name" | "address" | "defaultTemplateId">>,
  userId: string,
  userName: string
): Promise<OrganizationSettings> {
  const updated = await apiPatch<OrganizationSettings>("/api/settings", updates);
  settingsCache = updated;
  notifyDataChange("settings");

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
  return settingsCache.name || "My Company";
}

export function getOrganizationAddress(): string {
  return settingsCache.address || "";
}
