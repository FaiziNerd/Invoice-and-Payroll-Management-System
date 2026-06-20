import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { generateSalarySlipsSchema } from "@/lib/api/payroll/schemas";
import { rowToSalarySlip, type SalarySlipRow } from "@/lib/api/salary-slips/mappers";

const WRITE_ROLES = ["admin", "hr"] as const;

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

  const parsed = generateSalarySlipsSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.errors[0]?.message ?? "Invalid input",
      400
    );
  }

  const { data: run, error: runError } = await supabase
    .from("payroll_runs")
    .select("id, month, year")
    .eq("id", parsed.data.runId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (runError) {
    return fail("INTERNAL_ERROR", runError.message, 500);
  }

  if (!run) {
    return fail("NOT_FOUND", "Payroll run not found", 404);
  }

  const { data: existingSlips, error: existingError } = await supabase
    .from("salary_slips")
    .select(
      "id, company_id, payroll_run_id, employee_id, month, year, base_salary, allowances, deductions, bonus, one_off_deduction, gross_pay, total_deductions, net_pay, generated_at"
    )
    .eq("company_id", companyId)
    .eq("payroll_run_id", run.id);

  if (existingError) {
    return fail("INTERNAL_ERROR", existingError.message, 500);
  }

  if ((existingSlips ?? []).length > 0) {
    return ok((existingSlips as SalarySlipRow[]).map(rowToSalarySlip));
  }

  const { data: entries, error: entriesError } = await supabase
    .from("payroll_entries")
    .select(
      "employee_id, base_salary, bonus, one_off_deduction, gross_pay, total_deductions, net_pay, allowances, deductions"
    )
    .eq("payroll_run_id", run.id);

  if (entriesError) {
    return fail("INTERNAL_ERROR", entriesError.message, 500);
  }

  const inserts = (entries ?? []).map((entry) => ({
    company_id: companyId,
    payroll_run_id: run.id,
    employee_id: (entry as { employee_id: string }).employee_id,
    month: run.month,
    year: run.year,
    base_salary: (entry as { base_salary: number | string }).base_salary,
    bonus: (entry as { bonus: number | string }).bonus,
    one_off_deduction: (entry as { one_off_deduction: number | string }).one_off_deduction,
    gross_pay: (entry as { gross_pay: number | string }).gross_pay,
    total_deductions: (entry as { total_deductions: number | string }).total_deductions,
    net_pay: (entry as { net_pay: number | string }).net_pay,
    allowances: (entry as { allowances: unknown }).allowances,
    deductions: (entry as { deductions: unknown }).deductions,
  }));

  if (inserts.length > 0) {
    const { error: insertError } = await supabase.from("salary_slips").insert(inserts);
    if (insertError && insertError.code !== "23505") {
      return fail("INTERNAL_ERROR", insertError.message, 500);
    }
  }

  const { data: slips, error: slipsError } = await supabase
    .from("salary_slips")
    .select(
      "id, company_id, payroll_run_id, employee_id, month, year, base_salary, allowances, deductions, bonus, one_off_deduction, gross_pay, total_deductions, net_pay, generated_at"
    )
    .eq("company_id", companyId)
    .eq("payroll_run_id", run.id)
    .order("generated_at", { ascending: false });

  if (slipsError) {
    return fail("INTERNAL_ERROR", slipsError.message, 500);
  }

  return ok(((slips ?? []) as SalarySlipRow[]).map(rowToSalarySlip));
}
