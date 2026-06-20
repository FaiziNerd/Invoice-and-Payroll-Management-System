import type { InvoiceTemplate, TemplateBranding } from "@/types";
import { addAuditLog } from "@/lib/audit";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/fetch";
import { notifyDataChange } from "@/lib/data/events";

const defaultBranding = (
  overrides: Partial<TemplateBranding> = {}
): TemplateBranding => ({
  primaryColor: "#2563eb",
  secondaryColor: "#64748b",
  fontFamily: "Inter",
  sections: { logo: true, notes: true, paymentTerms: true, footer: true },
  companyName: "My Company",
  companyAddress: "",
  paymentTerms: "Payment due within 30 days of invoice date.",
  footerText: "Thank you for your business!",
  ...overrides,
});

export const PRESET_TEMPLATES: Omit<
  InvoiceTemplate,
  "id" | "createdAt" | "updatedAt"
>[] = [
  {
    name: "Classic",
    isDefault: true,
    isActive: true,
    theme: "classic",
    branding: defaultBranding({
      primaryColor: "#1e3a5f",
      secondaryColor: "#4a5568",
    }),
  },
  {
    name: "Modern",
    isDefault: false,
    isActive: true,
    theme: "modern",
    branding: defaultBranding({
      primaryColor: "#7c3aed",
      secondaryColor: "#a78bfa",
      fontFamily: "Inter",
    }),
  },
  {
    name: "Minimal",
    isDefault: false,
    isActive: true,
    theme: "minimal",
    branding: defaultBranding({
      primaryColor: "#18181b",
      secondaryColor: "#71717a",
      sections: { logo: false, notes: true, paymentTerms: false, footer: true },
    }),
  },
];

let templatesCache: InvoiceTemplate[] = [];

function sortTemplates(templates: InvoiceTemplate[]): InvoiceTemplate[] {
  return [...templates].sort((a, b) => a.name.localeCompare(b.name));
}

function upsertCache(template: InvoiceTemplate): void {
  const index = templatesCache.findIndex((t) => t.id === template.id);
  if (index === -1) {
    templatesCache = sortTemplates([...templatesCache, template]);
    return;
  }
  templatesCache = templatesCache.map((t) => (t.id === template.id ? template : t));
}

function removeFromCache(id: string): void {
  templatesCache = templatesCache.filter((t) => t.id !== id);
}

function enforceSingleDefault(id: string): void {
  templatesCache = templatesCache.map((t) => ({
    ...t,
    isDefault: t.id === id,
  }));
}

export async function loadTemplatesFromApi(): Promise<InvoiceTemplate[]> {
  try {
    templatesCache = await apiGet<InvoiceTemplate[]>("/api/templates");
    return templatesCache;
  } catch {
    templatesCache = [];
    return templatesCache;
  }
}

export function getTemplates(companyId?: string): InvoiceTemplate[] {
  void companyId;
  return templatesCache;
}

export function getActiveTemplates(): InvoiceTemplate[] {
  return templatesCache.filter((t) => t.isActive);
}

export function getTemplateById(id: string): InvoiceTemplate | undefined {
  return templatesCache.find((t) => t.id === id);
}

export async function fetchTemplateById(id: string): Promise<InvoiceTemplate | undefined> {
  const cached = getTemplateById(id);
  if (cached) return cached;
  try {
    const template = await apiGet<InvoiceTemplate>(`/api/templates/${id}`);
    upsertCache(template);
    return template;
  } catch {
    return undefined;
  }
}

/** @deprecated Public share still resolves templates from in-memory cache */
export function findTemplateById(id: string): InvoiceTemplate | undefined {
  return getTemplateById(id);
}

export function getDefaultTemplate(): InvoiceTemplate | undefined {
  return templatesCache.find((t) => t.isDefault) ?? templatesCache[0];
}

export async function createTemplate(
  data: Omit<InvoiceTemplate, "id" | "createdAt" | "updatedAt">,
  userId: string,
  userName: string
): Promise<InvoiceTemplate> {
  const template = await apiPost<InvoiceTemplate>("/api/templates", data);
  upsertCache(template);
  if (template.isDefault) {
    enforceSingleDefault(template.id);
  }
  notifyDataChange("templates");

  addAuditLog({
    action: "create",
    entity: "template",
    entityId: template.id,
    userId,
    userName,
    description: `Created template ${template.name}`,
  });

  return template;
}

export async function updateTemplate(
  id: string,
  data: Partial<InvoiceTemplate>,
  userId: string,
  userName: string
): Promise<InvoiceTemplate | null> {
  try {
    const template = await apiPatch<InvoiceTemplate>(`/api/templates/${id}`, data);
    upsertCache(template);
    if (template.isDefault) {
      enforceSingleDefault(template.id);
    }
    notifyDataChange("templates");

    addAuditLog({
      action: "update",
      entity: "template",
      entityId: id,
      userId,
      userName,
      description: `Updated template ${template.name}`,
    });

    return template;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("not found")) {
      return null;
    }
    throw error;
  }
}

export async function publishTemplate(
  id: string,
  userId: string,
  userName: string
): Promise<InvoiceTemplate | null> {
  try {
    const template = await apiPost<InvoiceTemplate>(`/api/templates/${id}/publish`);
    upsertCache(template);
    notifyDataChange("templates");

    addAuditLog({
      action: "update",
      entity: "template",
      entityId: id,
      userId,
      userName,
      description: `Published template ${template.name}`,
    });

    return template;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("not found")) {
      return null;
    }
    throw error;
  }
}

export async function deleteTemplate(
  id: string,
  userId: string,
  userName: string
): Promise<boolean> {
  const template = getTemplateById(id);
  await apiDelete<{ deleted: true }>(`/api/templates/${id}`);
  removeFromCache(id);
  notifyDataChange("templates");

  addAuditLog({
    action: "delete",
    entity: "template",
    entityId: id,
    userId,
    userName,
    description: `Deleted template ${template?.name ?? id}`,
  });

  return true;
}

export async function duplicateTemplate(
  id: string,
  userId: string,
  userName: string
): Promise<InvoiceTemplate | null> {
  try {
    const duplicated = await apiPost<InvoiceTemplate>(`/api/templates/${id}/duplicate`);
    upsertCache(duplicated);
    notifyDataChange("templates");

    addAuditLog({
      action: "create",
      entity: "template",
      entityId: duplicated.id,
      userId,
      userName,
      description: `Duplicated template ${duplicated.name}`,
    });

    return duplicated;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("not found")) {
      return null;
    }
    throw error;
  }
}

export async function seedTemplates(companyId?: string): Promise<void> {
  void companyId;
  if (typeof window !== "undefined") return;
  // Server-side bootstrap should seed templates through privileged scripts/jobs.
}
