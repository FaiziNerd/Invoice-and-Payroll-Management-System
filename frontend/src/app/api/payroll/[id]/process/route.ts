import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { rowToPayrollRun, type PayrollRunRow } from "@/lib/api/payroll/mappers";

const WRITE_ROLES = ["admin", "accountant", "hr"] as const;
const RUN_SELECT =
  "id, company_id, month, year, status, total_gross, total_net, processed_at, created_at, payroll_entries(id, payroll_run_id, employee_id, base_salary, bonus, one_off_deduction, gross_pay, total_deductions, net_pay, allowances, deductions)";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const result = await requireCompanyContext({ roles: [...WRITE_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  const { data: existing, error: existingError } = await supabase
    .from("payroll_runs")
    .select("id")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (existingError) {
    return fail("INTERNAL_ERROR", existingError.message, 500);
  }

  if (!existing) {
    return fail("NOT_FOUND", "Payroll run not found", 404);
  }

  const { error: updateError } = await supabase
    .from("payroll_runs")
    .update({
      status: "processed",
      processed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("company_id", companyId);

  if (updateError) {
    return fail("INTERNAL_ERROR", updateError.message, 500);
  }

  const { data, error } = await supabase
    .from("payroll_runs")
    .select(RUN_SELECT)
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  if (!data) {
    return fail("NOT_FOUND", "Payroll run not found", 404);
  }

  return ok(rowToPayrollRun(data as PayrollRunRow));
}
