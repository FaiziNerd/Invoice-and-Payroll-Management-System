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

  const { data, error } = await supabase
    .from("invoice_templates")
    .update({ is_active: true })
    .eq("id", id)
    .eq("company_id", companyId)
    .select(TEMPLATE_COLUMNS)
    .maybeSingle();

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  if (!data) {
    return fail("NOT_FOUND", "Template not found", 404);
  }

  return ok(rowToTemplate(data));
}
