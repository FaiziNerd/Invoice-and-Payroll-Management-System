import type { InvoiceTemplate, TemplateBranding } from "@/types";
import { templateFieldsToRow } from "@/lib/api/templates/mappers";
import type { SupabaseClient } from "@supabase/supabase-js";

const defaultBranding = (
  companyName: string,
  overrides: Partial<TemplateBranding> = {}
): TemplateBranding => ({
  primaryColor: "#2563eb",
  secondaryColor: "#64748b",
  fontFamily: "Inter",
  sections: { logo: true, notes: true, paymentTerms: true, footer: true },
  companyName,
  companyAddress: "",
  paymentTerms: "Payment due within 30 days of invoice date.",
  footerText: "Thank you for your business!",
  ...overrides,
});

const PRESETS: Omit<InvoiceTemplate, "id" | "createdAt" | "updatedAt">[] = [
  {
    name: "Classic",
    isDefault: true,
    isActive: true,
    theme: "classic",
    branding: defaultBranding("My Company", {
      primaryColor: "#1e3a5f",
      secondaryColor: "#4a5568",
    }),
  },
  {
    name: "Modern",
    isDefault: false,
    isActive: true,
    theme: "modern",
    branding: defaultBranding("My Company", {
      primaryColor: "#7c3aed",
      secondaryColor: "#a78bfa",
    }),
  },
  {
    name: "Minimal",
    isDefault: false,
    isActive: true,
    theme: "minimal",
    branding: defaultBranding("My Company", {
      primaryColor: "#18181b",
      secondaryColor: "#71717a",
      sections: { logo: false, notes: true, paymentTerms: false, footer: true },
    }),
  },
];

export async function seedCompanyTemplates(
  admin: SupabaseClient,
  companyId: string,
  companyName: string
): Promise<string | null> {
  const { count } = await admin
    .from("invoice_templates")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);

  if ((count ?? 0) > 0) return null;

  let defaultId: string | null = null;

  for (const preset of PRESETS) {
    const branding = {
      ...preset.branding,
      companyName: companyName.trim() || preset.branding.companyName,
    };
    const row = templateFieldsToRow({ ...preset, branding });
    const { data, error } = await admin
      .from("invoice_templates")
      .insert({ company_id: companyId, ...row })
      .select("id, is_default")
      .single();

    if (error) throw error;
    if (data.is_default) defaultId = data.id;
  }

  if (defaultId) {
    await admin
      .from("organization_settings")
      .update({ default_template_id: defaultId })
      .eq("company_id", companyId);
  }

  return defaultId;
}
