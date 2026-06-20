import type { OrganizationSettings } from "@/types";

export interface OrganizationSettingsRow {
  company_id: string;
  name: string;
  address: string | null;
  default_template_id: string | null;
  updated_at: string;
}

export function rowToSettings(row: OrganizationSettingsRow): OrganizationSettings {
  return {
    id: row.company_id,
    name: row.name,
    address: row.address ?? "",
    defaultTemplateId: row.default_template_id ?? "",
  };
}

export function settingsFieldsToRow(
  fields: Partial<Pick<OrganizationSettings, "name" | "address" | "defaultTemplateId">>
) {
  const updates: {
    name?: string;
    address?: string | null;
    default_template_id?: string | null;
  } = {};

  if (fields.name !== undefined) updates.name = fields.name;
  if (fields.address !== undefined) updates.address = fields.address || null;
  if (fields.defaultTemplateId !== undefined) {
    updates.default_template_id = fields.defaultTemplateId || null;
  }

  return updates;
}
