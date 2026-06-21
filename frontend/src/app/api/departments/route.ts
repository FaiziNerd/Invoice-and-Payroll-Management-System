import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { createDepartmentSchema } from "@/lib/api/departments/schemas";
import { departmentFieldsToRow, rowToDepartment } from "@/lib/api/departments/mappers";
import { auditMutation, getActorName } from "@/lib/server/audit-helpers";
import { createAdminClient } from "@/lib/supabase/admin";

const DEPARTMENT_SELECT = "id, company_id, name, description, created_at";

async function insertDepartment(
  companyId: string,
  fields: { name: string; description: string }
) {
  const admin = createAdminClient();
  const row = {
    company_id: companyId,
    ...departmentFieldsToRow(fields),
  };

  const { error: insertError } = await admin.from("departments").insert(row);

  if (insertError) {
    return { error: insertError.message };
  }

  const { data: fetched, error: fetchError } = await admin
    .from("departments")
    .select(DEPARTMENT_SELECT)
    .eq("company_id", companyId)
    .eq("name", fields.name)
    .order("created_at", { ascending: false })
    .limit(1);

  if (fetchError) {
    return { error: fetchError.message };
  }

  if (!fetched?.[0]) {
    return {
      error:
        "Insert completed but the department was not found. Check Supabase Table Editor → departments for a company_id column and valid company_id.",
    };
  }

  return { data: fetched[0] };
}

const WRITE_ROLES = ["admin", "hr"] as const;

export async function GET() {
  const result = await requireCompanyContext();
  if ("error" in result) return result.error;
  const { companyId } = result.ctx;

  const { data, error } = await createAdminClient()
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
  const { supabase, companyId, user } = result.ctx;

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

  const { data, error: insertMessage } = await insertDepartment(companyId, parsed.data);

  if (insertMessage) {
    return fail("INTERNAL_ERROR", insertMessage, 500);
  }

  if (!data) {
    return fail("INTERNAL_ERROR", "Department could not be created", 500);
  }

  const actorName = await getActorName(supabase, user.id, "User");
  await auditMutation(createAdminClient(), {
    companyId,
    userId: user.id,
    userName: actorName,
    action: "create",
    entity: "department",
    entityId: data.id,
    description: `Created department ${parsed.data.name}`,
    metadata: { after: { name: parsed.data.name } },
  });

  return ok(rowToDepartment(data), 201);
}
