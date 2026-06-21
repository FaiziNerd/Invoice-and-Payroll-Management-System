import type { SupabaseClient } from "@supabase/supabase-js";

function formatEmployeeId(n: number): string {
  return `EMP-${String(n).padStart(3, "0")}`;
}

/** Suggest the next employee ID for a company (EMP-001, EMP-002, …). */
export async function peekNextEmployeeId(
  supabase: SupabaseClient,
  companyId: string
): Promise<string> {
  const { data, error } = await supabase
    .from("employees")
    .select("employee_id")
    .eq("company_id", companyId);

  if (error) throw new Error(error.message);

  const max = (data ?? []).reduce((acc, row) => {
    const match = /^EMP-(\d+)$/i.exec(String(row.employee_id ?? "").trim());
    if (!match) return acc;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? Math.max(acc, parsed) : acc;
  }, 0);

  return formatEmployeeId(max + 1);
}
