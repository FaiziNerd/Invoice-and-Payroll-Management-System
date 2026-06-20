import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { rowToSalarySlip, type SalarySlipRow } from "@/lib/api/salary-slips/mappers";

export async function GET(request: Request) {
  const result = await requireCompanyContext();
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  const url = new URL(request.url);
  const runId = url.searchParams.get("runId");

  let query = supabase
    .from("salary_slips")
    .select(
      "id, company_id, payroll_run_id, employee_id, month, year, base_salary, allowances, deductions, bonus, one_off_deduction, gross_pay, total_deductions, net_pay, generated_at"
    )
    .eq("company_id", companyId)
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (runId) {
    query = query.eq("payroll_run_id", runId);
  }

  const { data, error } = await query;
  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  return ok(((data ?? []) as SalarySlipRow[]).map(rowToSalarySlip));
}
