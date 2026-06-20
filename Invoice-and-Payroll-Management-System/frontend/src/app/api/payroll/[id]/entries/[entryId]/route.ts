import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { updatePayrollEntrySchema } from "@/lib/api/payroll/schemas";
import {
  rowToPayrollRun,
  type PayrollEntryRow,
  type PayrollRunRow,
} from "@/lib/api/payroll/mappers";

const WRITE_ROLES = ["admin", "accountant", "hr"] as const;
const RUN_SELECT =
  "id, company_id, month, year, status, total_gross, total_net, processed_at, created_at, payroll_entries(id, payroll_run_id, employee_id, base_salary, bonus, one_off_deduction, gross_pay, total_deductions, net_pay, allowances, deductions)";

type RouteContext = { params: Promise<{ id: string; entryId: string }> };

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim().length > 0) return Number(value);
  return 0;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id, entryId } = await params;
  const result = await requireCompanyContext({ roles: [...WRITE_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION_ERROR", "Invalid JSON body", 400);
  }

  const parsed = updatePayrollEntrySchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.errors[0]?.message ?? "Invalid input",
      400
    );
  }

  const { data: run, error: runError } = await supabase
    .from("payroll_runs")
    .select("id")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (runError) {
    return fail("INTERNAL_ERROR", runError.message, 500);
  }

  if (!run) {
    return fail("NOT_FOUND", "Payroll run not found", 404);
  }

  const { data: entry, error: entryError } = await supabase
    .from("payroll_entries")
    .select(
      "id, payroll_run_id, employee_id, base_salary, bonus, one_off_deduction, gross_pay, total_deductions, net_pay, allowances, deductions"
    )
    .eq("id", entryId)
    .eq("payroll_run_id", id)
    .maybeSingle();

  if (entryError) {
    return fail("INTERNAL_ERROR", entryError.message, 500);
  }

  if (!entry) {
    return fail("NOT_FOUND", "Payroll entry not found", 404);
  }

  const typedEntry = entry as PayrollEntryRow;
  const allowances = Array.isArray(typedEntry.allowances) ? typedEntry.allowances : [];
  const deductions = Array.isArray(typedEntry.deductions) ? typedEntry.deductions : [];
  const allowanceTotal = allowances.reduce((sum, item) => {
    const row = item as Partial<{ amount: number | string }>;
    return sum + toNumber(row.amount);
  }, 0);
  const deductionTotal = deductions.reduce((sum, item) => {
    const row = item as Partial<{ amount: number | string }>;
    return sum + toNumber(row.amount);
  }, 0);

  const bonus = parsed.data.bonus ?? toNumber(typedEntry.bonus);
  const oneOffDeduction =
    parsed.data.oneOffDeduction ?? toNumber(typedEntry.one_off_deduction);
  const baseSalary = toNumber(typedEntry.base_salary);
  const grossPay = baseSalary + allowanceTotal + bonus;
  const totalDeductions = deductionTotal + oneOffDeduction;
  const netPay = grossPay - totalDeductions;

  const { error: updateError } = await supabase
    .from("payroll_entries")
    .update({
      bonus,
      one_off_deduction: oneOffDeduction,
      gross_pay: grossPay,
      total_deductions: totalDeductions,
      net_pay: netPay,
    })
    .eq("id", entryId)
    .eq("payroll_run_id", id);

  if (updateError) {
    return fail("INTERNAL_ERROR", updateError.message, 500);
  }

  const { data: totalsRows, error: totalsError } = await supabase
    .from("payroll_entries")
    .select("gross_pay, net_pay")
    .eq("payroll_run_id", id);

  if (totalsError) {
    return fail("INTERNAL_ERROR", totalsError.message, 500);
  }

  const totalGross = (totalsRows ?? []).reduce(
    (sum, row) => sum + toNumber((row as { gross_pay: number | string }).gross_pay),
    0
  );
  const totalNet = (totalsRows ?? []).reduce(
    (sum, row) => sum + toNumber((row as { net_pay: number | string }).net_pay),
    0
  );

  const { error: runUpdateError } = await supabase
    .from("payroll_runs")
    .update({
      total_gross: totalGross,
      total_net: totalNet,
    })
    .eq("id", id)
    .eq("company_id", companyId);

  if (runUpdateError) {
    return fail("INTERNAL_ERROR", runUpdateError.message, 500);
  }

  const { data: refreshedRun, error: refreshedRunError } = await supabase
    .from("payroll_runs")
    .select(RUN_SELECT)
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (refreshedRunError) {
    return fail("INTERNAL_ERROR", refreshedRunError.message, 500);
  }

  if (!refreshedRun) {
    return fail("NOT_FOUND", "Payroll run not found", 404);
  }

  return ok(rowToPayrollRun(refreshedRun as PayrollRunRow));
}
