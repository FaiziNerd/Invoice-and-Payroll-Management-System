import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { peekNextEmployeeId } from "@/lib/api/employees/numbering";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const result = await requireCompanyContext({ roles: ["admin", "hr"] });
  if ("error" in result) return result.error;
  const { companyId } = result.ctx;

  try {
    const employeeId = await peekNextEmployeeId(createAdminClient(), companyId);
    return ok({ employeeId });
  } catch (err) {
    return fail(
      "INTERNAL_ERROR",
      err instanceof Error ? err.message : "Failed to suggest employee ID",
      500
    );
  }
}
