import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { createPayrollRunSchema } from "@/lib/api/payroll/schemas";
import { rowToPayrollRun, type PayrollRunRow } from "@/lib/api/payroll/mappers";
import { rowToEmployee, type EmployeeRow } from "@/lib/api/employees/mappers";

const WRITE_ROLES = ["admin", "accountant", "hr"] as const;
const RUN_SELECT =
  "id, company_id, month, year, status, total_gross, total_net, processed_at, created_at, payroll_entries(id, payroll_run_id, employee_id, base_salary, bonus, one_off_deduction, gross_pay, total_deductions, net_pay, allowances, deductions)";
const EMPLOYEE_SNAPSHOT_SELECT =
  "id, company_id, employee_id, first_name, last_name, email, phone, department_id, position, join_date, status, salary_base, created_at, employee_allowances(id, employee_id, name, amount), employee_deductions(id, employee_id, name, amount)";

export async function GET() {
  const result = await requireCompanyContext();
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  const { data, error } = await supabase
    .from("payroll_runs")
    .select(RUN_SELECT)
    .eq("company_id", companyId)
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  return ok(((data ?? []) as PayrollRunRow[]).map(rowToPayrollRun));
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

  const parsed = createPayrollRunSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.errors[0]?.message ?? "Invalid input",
      400
    );
  }

  const { data: activeEmployees, error: employeesError } = await supabase
    .from("employees")
    .select(EMPLOYEE_SNAPSHOT_SELECT)
    .eq("company_id", companyId)
    .eq("status", "active");

  if (employeesError) {
    return fail("INTERNAL_ERROR", employeesError.message, 500);
  }

  const employeeSnapshots = ((activeEmployees ?? []) as EmployeeRow[]).map(rowToEmployee);
  const entries = employeeSnapshots.map((employee) => {
    const allowanceTotal = employee.salaryStructure.allowances.reduce(
      (sum, allowance) => sum + allowance.amount,
      0
    );
    const deductionTotal = employee.salaryStructure.deductions.reduce(
      (sum, deduction) => sum + deduction.amount,
      0
    );
    const grossPay = employee.salaryStructure.baseSalary + allowanceTotal;
    const totalDeductions = deductionTotal;
    const netPay = grossPay - totalDeductions;

    return {
      employee_id: employee.id,
      base_salary: employee.salaryStructure.baseSalary,
      bonus: 0,
      one_off_deduction: 0,
      gross_pay: grossPay,
      total_deductions: totalDeductions,
      net_pay: netPay,
      allowances: employee.salaryStructure.allowances,
      deductions: employee.salaryStructure.deductions,
    };
  });

  const totalGross = entries.reduce((sum, entry) => sum + entry.gross_pay, 0);
  const totalNet = entries.reduce((sum, entry) => sum + entry.net_pay, 0);

  const { data: run, error: runError } = await supabase
    .from("payroll_runs")
    .insert({
      company_id: companyId,
      month: parsed.data.month,
      year: parsed.data.year,
      status: "draft",
      total_gross: totalGross,
      total_net: totalNet,
    })
    .select("id")
    .single();

  if (runError) {
    if (runError.code === "23505") {
      return fail("CONFLICT", "Payroll run already exists for this month/year", 409);
    }
    return fail("INTERNAL_ERROR", runError.message, 500);
  }

  if (entries.length > 0) {
    const { error: entriesError } = await supabase.from("payroll_entries").insert(
      entries.map((entry) => ({
        payroll_run_id: run.id,
        ...entry,
      }))
    );

    if (entriesError) {
      await supabase.from("payroll_runs").delete().eq("id", run.id).eq("company_id", companyId);
      return fail("INTERNAL_ERROR", entriesError.message, 500);
    }
  }

  const { data: createdRun, error: createdRunError } = await supabase
    .from("payroll_runs")
    .select(RUN_SELECT)
    .eq("id", run.id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (createdRunError) {
    return fail("INTERNAL_ERROR", createdRunError.message, 500);
  }

  if (!createdRun) {
    return fail("NOT_FOUND", "Payroll run not found after creation", 404);
  }

  return ok(rowToPayrollRun(createdRun as PayrollRunRow), 201);
}
