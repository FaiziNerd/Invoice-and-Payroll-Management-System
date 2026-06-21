import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { fetchDashboardRawData } from "@/lib/analytics/fetch-dashboard-data";
import { generateAiPayrollInsights } from "@/lib/analytics/payroll-insights";

export const runtime = "nodejs";

export async function GET() {
  const result = await requireCompanyContext({
    roles: ["admin", "accountant", "hr"],
  });
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  try {
    const raw = await fetchDashboardRawData(supabase, companyId);
    const aiResult = await generateAiPayrollInsights(raw);
    if (!aiResult) {
      return ok({ insights: null, source: "rules" as const });
    }
    return ok(aiResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate AI insights";
    return fail("INTERNAL_ERROR", message, 500);
  }
}
