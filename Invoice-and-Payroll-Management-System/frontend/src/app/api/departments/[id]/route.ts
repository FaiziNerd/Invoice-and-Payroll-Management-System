import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { updateDepartmentSchema } from "@/lib/api/departments/schemas";
import { rowToDepartment } from "@/lib/api/departments/mappers";

const WRITE_ROLES = ["admin", "hr"] as const;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const result = await requireCompanyContext();
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  const { data, error } = await supabase
    .from("departments")
    .select("id, company_id, name, description, created_at")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  if (!data) {
    return fail("NOT_FOUND", "Department not found", 404);
  }

  return ok(rowToDepartment(data));
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const result = await requireCompanyContext({ roles: [...WRITE_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION_ERROR", "Invalid JSON body", 400);
  }

  const parsed = updateDepartmentSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.errors[0]?.message ?? "Invalid input",
      400
    );
  }

  const updates: Record<string, string | null> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) {
    updates.description = parsed.data.description || null;
  }

  const { data, error } = await supabase
    .from("departments")
    .update(updates)
    .eq("id", id)
    .eq("company_id", companyId)
    .select("id, company_id, name, description, created_at")
    .maybeSingle();

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  if (!data) {
    return fail("NOT_FOUND", "Department not found", 404);
  }

  return ok(rowToDepartment(data));
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const result = await requireCompanyContext({ roles: [...WRITE_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  const { count, error: employeeError } = await supabase
    .from("employees")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("department_id", id);

  if (employeeError) {
    return fail("INTERNAL_ERROR", employeeError.message, 500);
  }

  if ((count ?? 0) > 0) {
    return fail(
      "CONFLICT",
      "Cannot delete this department because it has assigned employees.",
      409
    );
  }

  const { data, error } = await supabase
    .from("departments")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId)
    .select("id")
    .maybeSingle();

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  if (!data) {
    return fail("NOT_FOUND", "Department not found", 404);
  }

  return ok({ deleted: true });
}
