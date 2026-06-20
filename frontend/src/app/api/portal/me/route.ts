import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { rowToEmployee, type EmployeeRow } from "@/lib/api/employees/mappers";
import { rowToSalarySlip, type SalarySlipRow } from "@/lib/api/salary-slips/mappers";

const EMPLOYEE_SELECT =
  "id, company_id, employee_id, first_name, last_name, email, phone, department_id, position, join_date, status, salary_base, user_id, created_at, deleted_at, employee_allowances(id, employee_id, name, amount), employee_deductions(id, employee_id, name, amount)";

export async function GET() {
  const result = await requireCompanyContext({ roles: ["employee"] });
  if ("error" in result) return result.error;
  const { supabase, companyId, employeeId } = result.ctx;

  if (!employeeId) {
    return fail("FORBIDDEN", "Employee profile is not linked to your account", 403);
  }

  const { data: employeeRow, error: employeeError } = await supabase
    .from("employees")
    .select(EMPLOYEE_SELECT)
    .eq("id", employeeId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (employeeError) return fail("INTERNAL_ERROR", employeeError.message, 500);
  if (!employeeRow) return fail("NOT_FOUND", "Employee profile not found", 404);

  const { data: slipRows, error: slipsError } = await supabase
    .from("salary_slips")
    .select(
      "id, company_id, employee_id, payroll_run_id, month, year, base_salary, allowances, deductions, bonus, one_off_deduction, gross_pay, total_deductions, net_pay, generated_at"
    )
    .eq("company_id", companyId)
    .eq("employee_id", employeeId)
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (slipsError) return fail("INTERNAL_ERROR", slipsError.message, 500);

  return ok({
    employee: rowToEmployee(employeeRow as EmployeeRow),
    salarySlips: ((slipRows ?? []) as SalarySlipRow[]).map(rowToSalarySlip),
  });
}
