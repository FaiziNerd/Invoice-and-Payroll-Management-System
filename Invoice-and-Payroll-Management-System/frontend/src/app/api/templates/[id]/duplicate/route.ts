import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { rowToTemplate } from "@/lib/api/templates/mappers";

const WRITE_ROLES = ["admin", "accountant"] as const;

const TEMPLATE_COLUMNS =
  "id, company_id, name, is_default, is_active, theme, branding_logo, branding_primary_color, branding_secondary_color, branding_font_family, branding_show_logo, branding_show_notes, branding_show_payment_terms, branding_show_footer, branding_company_name, branding_company_address, branding_payment_terms, branding_footer_text, created_at, updated_at";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const result = await requireCompanyContext({ roles: [...WRITE_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  const { data: original, error: readError } = await supabase
    .from("invoice_templates")
    .select(TEMPLATE_COLUMNS)
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (readError) {
    return fail("INTERNAL_ERROR", readError.message, 500);
  }

  if (!original) {
    return fail("NOT_FOUND", "Template not found", 404);
  }

  const { data, error } = await supabase
    .from("invoice_templates")
    .insert({
      company_id: companyId,
      name: `${original.name} (Copy)`,
      is_default: false,
      is_active: false,
      theme: original.theme,
      branding_logo: original.branding_logo,
      branding_primary_color: original.branding_primary_color,
      branding_secondary_color: original.branding_secondary_color,
      branding_font_family: original.branding_font_family,
      branding_show_logo: original.branding_show_logo,
      branding_show_notes: original.branding_show_notes,
      branding_show_payment_terms: original.branding_show_payment_terms,
      branding_show_footer: original.branding_show_footer,
      branding_company_name: original.branding_company_name,
      branding_company_address: original.branding_company_address,
      branding_payment_terms: original.branding_payment_terms,
      branding_footer_text: original.branding_footer_text,
    })
    .select(TEMPLATE_COLUMNS)
    .single();

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  return ok(rowToTemplate(data), 201);
}
