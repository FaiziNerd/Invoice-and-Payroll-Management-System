import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { createEmployeeSchema } from "@/lib/api/employees/schemas";
import {
  allowanceFieldsToRows,
  deductionFieldsToRows,
  employeeFieldsToRow,
  rowToEmployee,
  type EmployeeAllowanceRow,
  type EmployeeDeductionRow,
  type EmployeeRow,
} from "@/lib/api/employees/mappers";
import {
  applyCursorFilter,
  applySoftDeleteFilter,
  buildPaginatedResponse,
  parseListParams,
} from "@/lib/api/pagination";
import { auditMutation, getActorName } from "@/lib/server/audit-helpers";

const WRITE_ROLES = ["admin", "hr"] as const;
const EMPLOYEE_SELECT =
  "id, company_id, employee_id, first_name, last_name, email, phone, department_id, position, join_date, status, salary_base, user_id, created_at, deleted_at, employee_allowances(id, employee_id, name, amount), employee_deductions(id, employee_id, name, amount)";

export async function GET(request: Request) {
  const result = await requireCompanyContext({ roles: ["admin", "hr", "accountant"] });
  if ("error" in result) return result.error;
  const { supabase, companyId, role, employeeId } = result.ctx;

  const url = new URL(request.url);
  const { limit, cursor, includeDeleted, trashOnly } = parseListParams(url);

  let query = supabase
    .from("employees")
    .select(EMPLOYEE_SELECT)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (role === "employee" && employeeId) {
    query = query.eq("id", employeeId);
  }

  query = applySoftDeleteFilter(query, { includeDeleted, trashOnly });
  query = applyCursorFilter(query, cursor);

  const { data, error } = await query;

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  const mapped = ((data ?? []) as EmployeeRow[]).map(rowToEmployee);
  return ok(buildPaginatedResponse(mapped, limit));
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

  const parsed = createEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid input",
      400
    );
  }

  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .insert({
      company_id: companyId,
      ...employeeFieldsToRow(parsed.data),
    })
    .select(
      "id, company_id, employee_id, first_name, last_name, email, phone, department_id, position, join_date, status, salary_base, user_id, created_at, deleted_at"
    )
    .single();

  if (employeeError) {
    return fail("INTERNAL_ERROR", employeeError.message, 500);
  }

  const allowancesPayload = parsed.data.salaryStructure.allowances;
  const deductionsPayload = parsed.data.salaryStructure.deductions;

  let allowanceRows: EmployeeAllowanceRow[] = [];
  if (allowancesPayload.length > 0) {
    const { data, error } = await supabase
      .from("employee_allowances")
      .insert(allowanceFieldsToRows(employee.id, allowancesPayload))
      .select("id, employee_id, name, amount");

    if (error) {
      await supabase.from("employees").delete().eq("id", employee.id).eq("company_id", companyId);
      return fail("INTERNAL_ERROR", error.message, 500);
    }
    allowanceRows = (data ?? []) as EmployeeAllowanceRow[];
  }

  let deductionRows: EmployeeDeductionRow[] = [];
  if (deductionsPayload.length > 0) {
    const { data, error } = await supabase
      .from("employee_deductions")
      .insert(deductionFieldsToRows(employee.id, deductionsPayload))
      .select("id, employee_id, name, amount");

    if (error) {
      await supabase.from("employees").delete().eq("id", employee.id).eq("company_id", companyId);
      return fail("INTERNAL_ERROR", error.message, 500);
    }
    deductionRows = (data ?? []) as EmployeeDeductionRow[];
  }

  const actorName = await getActorName(supabase, user.id, "User");
  await auditMutation(supabase, {
    companyId,
    userId: user.id,
    userName: actorName,
    action: "create",
    entity: "employee",
    entityId: employee.id,
    description: `Created employee ${parsed.data.firstName} ${parsed.data.lastName}`,
    metadata: {
      after: {
        employeeId: parsed.data.employeeId,
        departmentId: parsed.data.departmentId,
        status: parsed.data.status,
      },
    },
  });

  return ok(
    rowToEmployee({
      ...(employee as EmployeeRow),
      employee_allowances: allowanceRows,
      employee_deductions: deductionRows,
    }),
    201
  );
}
