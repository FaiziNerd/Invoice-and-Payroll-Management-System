import type { InvoiceTemplate, TemplateBranding } from "@/types";

export interface InvoiceTemplateRow {
  id: string;
  company_id: string;
  name: string;
  is_default: boolean;
  is_active: boolean;
  theme: "classic" | "modern" | "minimal";
  branding_logo: string | null;
  branding_primary_color: string;
  branding_secondary_color: string;
  branding_font_family: string;
  branding_show_logo: boolean;
  branding_show_notes: boolean;
  branding_show_payment_terms: boolean;
  branding_show_footer: boolean;
  branding_company_name: string;
  branding_company_address: string | null;
  branding_payment_terms: string | null;
  branding_footer_text: string | null;
  created_at: string;
  updated_at: string;
}

type TemplateWritable = Omit<InvoiceTemplate, "id" | "createdAt" | "updatedAt">;

type TemplateRowWrite = {
  name?: string;
  is_default?: boolean;
  is_active?: boolean;
  theme?: "classic" | "modern" | "minimal";
  branding_logo?: string | null;
  branding_primary_color?: string;
  branding_secondary_color?: string;
  branding_font_family?: string;
  branding_show_logo?: boolean;
  branding_show_notes?: boolean;
  branding_show_payment_terms?: boolean;
  branding_show_footer?: boolean;
  branding_company_name?: string;
  branding_company_address?: string | null;
  branding_payment_terms?: string | null;
  branding_footer_text?: string | null;
};

function brandingToRow(branding: TemplateBranding): TemplateRowWrite {
  return {
    branding_logo: branding.logo || null,
    branding_primary_color: branding.primaryColor,
    branding_secondary_color: branding.secondaryColor,
    branding_font_family: branding.fontFamily,
    branding_show_logo: branding.sections.logo,
    branding_show_notes: branding.sections.notes,
    branding_show_payment_terms: branding.sections.paymentTerms,
    branding_show_footer: branding.sections.footer,
    branding_company_name: branding.companyName,
    branding_company_address: branding.companyAddress || null,
    branding_payment_terms: branding.paymentTerms || null,
    branding_footer_text: branding.footerText || null,
  };
}

export function rowToTemplate(row: InvoiceTemplateRow): InvoiceTemplate {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.is_default,
    isActive: row.is_active,
    theme: row.theme,
    branding: {
      logo: row.branding_logo ?? undefined,
      primaryColor: row.branding_primary_color,
      secondaryColor: row.branding_secondary_color,
      fontFamily: row.branding_font_family,
      sections: {
        logo: row.branding_show_logo,
        notes: row.branding_show_notes,
        paymentTerms: row.branding_show_payment_terms,
        footer: row.branding_show_footer,
      },
      companyName: row.branding_company_name,
      companyAddress: row.branding_company_address ?? "",
      paymentTerms: row.branding_payment_terms ?? "",
      footerText: row.branding_footer_text ?? "",
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function templateFieldsToRow(fields: TemplateWritable): TemplateRowWrite {
  return {
    name: fields.name,
    is_default: fields.isDefault,
    is_active: fields.isActive,
    theme: fields.theme,
    ...brandingToRow(fields.branding),
  };
}

export function templatePatchToRow(
  fields: Partial<TemplateWritable>
): TemplateRowWrite {
  const updates: TemplateRowWrite = {};

  if (fields.name !== undefined) updates.name = fields.name;
  if (fields.isDefault !== undefined) updates.is_default = fields.isDefault;
  if (fields.isActive !== undefined) updates.is_active = fields.isActive;
  if (fields.theme !== undefined) updates.theme = fields.theme;
  if (fields.branding !== undefined) {
    Object.assign(updates, brandingToRow(fields.branding));
  }

  return updates;
}
