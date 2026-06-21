import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { updateEmployeeSchema } from "@/lib/api/employees/schemas";
import {
  allowanceFieldsToRows,
  deductionFieldsToRows,
  rowToEmployee,
  type EmployeeRow,
} from "@/lib/api/employees/mappers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { auditMutation, buildDiff, getActorName } from "@/lib/server/audit-helpers";
import { createAdminClient } from "@/lib/supabase/admin";

const WRITE_ROLES = ["admin", "hr"] as const;
const EMPLOYEE_SELECT =
  "id, company_id, employee_id, first_name, last_name, email, phone, department_id, position, join_date, status, salary_base, user_id, created_at, deleted_at, employee_allowances(id, employee_id, name, amount), employee_deductions(id, employee_id, name, amount)";

type RouteContext = { params: Promise<{ id: string }> };

async function fetchEmployee(supabase: SupabaseClient, companyId: string, id: string) {
  const { data, error } = await supabase
    .from("employees")
    .select(EMPLOYEE_SELECT)
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    return { error: fail("INTERNAL_ERROR", error.message, 500) } as const;
  }

  if (!data) {
    return { error: fail("NOT_FOUND", "Employee not found", 404) } as const;
  }

  return { employee: data as EmployeeRow } as const;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const result = await requireCompanyContext();
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  const fetched = await fetchEmployee(supabase, companyId, id);
  if ("error" in fetched) return fetched.error;

  return ok(rowToEmployee(fetched.employee));
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

  const parsed = updateEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid input",
      400
    );
  }

  const existing = await fetchEmployee(supabase, companyId, id);
  if ("error" in existing) return existing.error;

  const beforeEmployee = existing.employee;

  const updates: Record<string, string | number | null> = {};
  if (parsed.data.employeeId !== undefined) updates.employee_id = parsed.data.employeeId;
  if (parsed.data.firstName !== undefined) updates.first_name = parsed.data.firstName;
  if (parsed.data.lastName !== undefined) updates.last_name = parsed.data.lastName;
  if (parsed.data.email !== undefined) updates.email = parsed.data.email;
  if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone || null;
  if (parsed.data.departmentId !== undefined) updates.department_id = parsed.data.departmentId;
  if (parsed.data.position !== undefined) updates.position = parsed.data.position || null;
  if (parsed.data.joinDate !== undefined) updates.join_date = parsed.data.joinDate;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.restore === true) {
    updates.deleted_at = null;
  }
  if (parsed.data.salaryStructure?.baseSalary !== undefined) {
    updates.salary_base = parsed.data.salaryStructure.baseSalary;
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await createAdminClient()
      .from("employees")
      .update(updates)
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) {
      return fail("INTERNAL_ERROR", error.message, 500);
    }
  }

  const admin = createAdminClient();

  if (parsed.data.salaryStructure?.allowances !== undefined) {
    const { error: deleteError } = await admin
      .from("employee_allowances")
      .delete()
      .eq("employee_id", id);

    if (deleteError) {
      return fail("INTERNAL_ERROR", deleteError.message, 500);
    }

    if (parsed.data.salaryStructure.allowances.length > 0) {
      const { error: insertError } = await admin
        .from("employee_allowances")
        .insert(allowanceFieldsToRows(id, parsed.data.salaryStructure.allowances));
      if (insertError) {
        return fail("INTERNAL_ERROR", insertError.message, 500);
      }
    }
  }

  if (parsed.data.salaryStructure?.deductions !== undefined) {
    const { error: deleteError } = await admin
      .from("employee_deductions")
      .delete()
      .eq("employee_id", id);

    if (deleteError) {
      return fail("INTERNAL_ERROR", deleteError.message, 500);
    }

    if (parsed.data.salaryStructure.deductions.length > 0) {
      const { error: insertError } = await admin
        .from("employee_deductions")
        .insert(deductionFieldsToRows(id, parsed.data.salaryStructure.deductions));
      if (insertError) {
        return fail("INTERNAL_ERROR", insertError.message, 500);
      }
    }
  }

  const refreshed = await fetchEmployee(supabase, companyId, id);
  if ("error" in refreshed) return refreshed.error;

  const actorName = await getActorName(supabase, user.id, "User");
  const afterEmployee = refreshed.employee;
  await auditMutation(supabase, {
    companyId,
    userId: user.id,
    userName: actorName,
    action: "update",
    entity: "employee",
    entityId: id,
    description: `Updated employee ${afterEmployee.first_name} ${afterEmployee.last_name}`,
    metadata: buildDiff(
      {
        firstName: beforeEmployee.first_name,
        lastName: beforeEmployee.last_name,
        email: beforeEmployee.email,
        departmentId: beforeEmployee.department_id,
        status: beforeEmployee.status,
        salaryBase: beforeEmployee.salary_base,
      },
      {
        firstName: afterEmployee.first_name,
        lastName: afterEmployee.last_name,
        email: afterEmployee.email,
        departmentId: afterEmployee.department_id,
        status: afterEmployee.status,
        salaryBase: afterEmployee.salary_base,
      }
    ),
  });

  return ok(rowToEmployee(refreshed.employee));
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const result = await requireCompanyContext({ roles: [...WRITE_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId, user } = result.ctx;

  const existing = await fetchEmployee(supabase, companyId, id);
  if ("error" in existing) return existing.error;

  const emp = existing.employee;

  const { count, error: guardError } = await supabase
    .from("payroll_entries")
    .select("*", { count: "exact", head: true })
    .eq("employee_id", id);

  if (guardError) {
    return fail("INTERNAL_ERROR", guardError.message, 500);
  }

  void count;

  const { error } = await createAdminClient()
    .from("employees")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", companyId)
    .is("deleted_at", null);

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  const actorName = await getActorName(supabase, user.id, "User");
  await auditMutation(supabase, {
    companyId,
    userId: user.id,
    userName: actorName,
    action: "delete",
    entity: "employee",
    entityId: id,
    description: `Deleted employee ${emp.first_name} ${emp.last_name}`,
  });

  return ok({ deleted: true });
}
