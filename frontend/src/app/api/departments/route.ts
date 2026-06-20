import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { createDepartmentSchema } from "@/lib/api/departments/schemas";
import { departmentFieldsToRow, rowToDepartment } from "@/lib/api/departments/mappers";

const WRITE_ROLES = ["admin", "hr"] as const;

export async function GET() {
  const result = await requireCompanyContext();
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  const { data, error } = await supabase
    .from("departments")
    .select("id, company_id, name, description, created_at")
    .eq("company_id", companyId)
    .order("name", { ascending: true });

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  return ok((data ?? []).map(rowToDepartment));
}

export async function POST(request: Request) {
  const result = await requireCompanyContext({ roles: [...WRITE_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION_ERROR", "Invalid JSON body", 400);
  }

  const parsed = createDepartmentSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid input",
      400
    );
  }

  const { data, error } = await supabase
    .from("departments")
    .insert({
      company_id: companyId,
      ...departmentFieldsToRow(parsed.data),
    })
    .select("id, company_id, name, description, created_at")
    .single();

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  return ok(rowToDepartment(data), 201);
}
