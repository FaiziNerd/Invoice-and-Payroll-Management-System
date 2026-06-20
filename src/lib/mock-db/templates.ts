import { getFromStorage, setInStorage } from "./storage";
import type { InvoiceTemplate, TemplateBranding } from "@/types";
import { generateId } from "@/lib/utils";
import { addAuditLog } from "@/lib/audit";

const KEY = "templates";

const defaultBranding = (
  overrides: Partial<TemplateBranding> = {}
): TemplateBranding => ({
  primaryColor: "#2563eb",
  secondaryColor: "#64748b",
  fontFamily: "Inter",
  sections: { logo: true, notes: true, paymentTerms: true, footer: true },
  companyName: "DotCode Solutions",
  companyAddress: "123 Business Ave, Suite 100, New York, NY 10001",
  paymentTerms: "Payment due within 30 days of invoice date.",
  footerText: "Thank you for your business!",
  ...overrides,
});

export const PRESET_TEMPLATES: Omit<InvoiceTemplate, "id" | "createdAt" | "updatedAt">[] = [
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

export function getTemplates(): InvoiceTemplate[] {
  return getFromStorage<InvoiceTemplate[]>(KEY, []);
}

export function getTemplateById(id: string): InvoiceTemplate | undefined {
  return getTemplates().find((t) => t.id === id);
}

export function getDefaultTemplate(): InvoiceTemplate | undefined {
  return getTemplates().find((t) => t.isDefault) || getTemplates()[0];
}

export function createTemplate(
  data: Omit<InvoiceTemplate, "id" | "createdAt" | "updatedAt">,
  userId: string,
  userName: string
): InvoiceTemplate {
  const template: InvoiceTemplate = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const templates = getTemplates();
  if (template.isDefault) {
    templates.forEach((t) => (t.isDefault = false));
  }
  templates.push(template);
  setInStorage(KEY, templates);
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

export function updateTemplate(
  id: string,
  data: Partial<InvoiceTemplate>,
  userId: string,
  userName: string
): InvoiceTemplate | null {
  const templates = getTemplates();
  const index = templates.findIndex((t) => t.id === id);
  if (index === -1) return null;
  if (data.isDefault) {
    templates.forEach((t) => (t.isDefault = false));
  }
  templates[index] = {
    ...templates[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  setInStorage(KEY, templates);
  addAuditLog({
    action: "update",
    entity: "template",
    entityId: id,
    userId,
    userName,
    description: `Updated template ${templates[index].name}`,
  });
  return templates[index];
}

export function deleteTemplate(
  id: string,
  userId: string,
  userName: string
): boolean {
  const templates = getTemplates();
  const template = templates.find((t) => t.id === id);
  if (!template || template.isDefault) return false;
  setInStorage(
    KEY,
    templates.filter((t) => t.id !== id)
  );
  addAuditLog({
    action: "delete",
    entity: "template",
    entityId: id,
    userId,
    userName,
    description: `Deleted template ${template.name}`,
  });
  return true;
}

export function duplicateTemplate(
  id: string,
  userId: string,
  userName: string
): InvoiceTemplate | null {
  const original = getTemplateById(id);
  if (!original) return null;
  return createTemplate(
    {
      name: `${original.name} (Copy)`,
      isDefault: false,
      isActive: false,
      theme: original.theme,
      branding: { ...original.branding },
    },
    userId,
    userName
  );
}

export function seedTemplates(): void {
  if (getTemplates().length > 0) return;
  const now = new Date().toISOString();
  const templates: InvoiceTemplate[] = PRESET_TEMPLATES.map((t) => ({
    ...t,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  }));
  setInStorage(KEY, templates);
}
