import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { updateTemplateSchema } from "@/lib/api/templates/schemas";
import { rowToTemplate, templatePatchToRow } from "@/lib/api/templates/mappers";
import { auditMutation, buildDiff, getActorName } from "@/lib/server/audit-helpers";

const WRITE_ROLES = ["admin", "accountant"] as const;

const TEMPLATE_COLUMNS =
  "id, company_id, name, is_default, is_active, theme, branding_logo, branding_primary_color, branding_secondary_color, branding_font_family, branding_show_logo, branding_show_notes, branding_show_payment_terms, branding_show_footer, branding_company_name, branding_company_address, branding_payment_terms, branding_footer_text, created_at, updated_at";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const result = await requireCompanyContext();
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  const { data, error } = await supabase
    .from("invoice_templates")
    .select(TEMPLATE_COLUMNS)
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  if (!data) {
    return fail("NOT_FOUND", "Template not found", 404);
  }

  return ok(rowToTemplate(data));
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const result = await requireCompanyContext({ roles: [...WRITE_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId, user } = result.ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION_ERROR", "Invalid JSON body", 400);
  }

  const parsed = updateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid input",
      400
    );
  }

  if (parsed.data.isDefault === true) {
    const { error: resetError } = await supabase
      .from("invoice_templates")
      .update({ is_default: false })
      .eq("company_id", companyId)
      .eq("is_default", true)
      .neq("id", id);
    if (resetError) {
      return fail("INTERNAL_ERROR", resetError.message, 500);
    }
  }

  const { data: before, error: beforeError } = await supabase
    .from("invoice_templates")
    .select("id, name, is_default, is_active, theme")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (beforeError) return fail("INTERNAL_ERROR", beforeError.message, 500);
  if (!before) return fail("NOT_FOUND", "Template not found", 404);

  const updates: Record<string, unknown> = templatePatchToRow(parsed.data);
  if (parsed.data.restore === true) {
    updates.deleted_at = null;
  }

  const { data, error } = await supabase
    .from("invoice_templates")
    .update(updates)
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

  const actorName = await getActorName(supabase, user.id, "User");
  await auditMutation(supabase, {
    companyId,
    userId: user.id,
    userName: actorName,
    action: "update",
    entity: "template",
    entityId: id,
    description: `Updated invoice template ${data.name}`,
    metadata: buildDiff(
      {
        name: before.name,
        isDefault: before.is_default,
        isActive: before.is_active,
        theme: before.theme,
      },
      {
        name: data.name,
        isDefault: data.is_default,
        isActive: data.is_active,
        theme: data.theme,
      }
    ),
  });

  return ok(rowToTemplate(data));
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const result = await requireCompanyContext({ roles: [...WRITE_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId, user } = result.ctx;

  const { data: current, error: currentError } = await supabase
    .from("invoice_templates")
    .select("id, is_default, name")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (currentError) {
    return fail("INTERNAL_ERROR", currentError.message, 500);
  }

  if (!current) {
    return fail("NOT_FOUND", "Template not found", 404);
  }

  if (current.is_default) {
    return fail("CONFLICT", "Cannot delete default template", 409);
  }

  const { data, error } = await supabase
    .from("invoice_templates")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  if (!data) {
    return fail("NOT_FOUND", "Template not found", 404);
  }

  const actorName = await getActorName(supabase, user.id, "User");
  await auditMutation(supabase, {
    companyId,
    userId: user.id,
    userName: actorName,
    action: "delete",
    entity: "template",
    entityId: id,
    description: `Deleted invoice template ${current.name}`,
  });

  return ok({ deleted: true });
}
