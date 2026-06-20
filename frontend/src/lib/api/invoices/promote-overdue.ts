import type { SupabaseClient } from "@supabase/supabase-js";
import { OVERDUE_HISTORY_ACTION } from "@/lib/api/invoices/utils";

/**
 * Promote past-due sent invoices to overdue and record system history.
 * Uses conditional updates so concurrent callers do not duplicate history.
 */
export async function promoteOverdueInvoices(
  supabase: SupabaseClient,
  companyId: string
): Promise<number> {
  const now = new Date().toISOString();
  let promoted = 0;

  const { data: sentPastDue, error: sentError } = await supabase
    .from("invoices")
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "sent")
    .lt("due_date", now);

  if (sentError) {
    throw new Error(sentError.message);
  }

  for (const row of sentPastDue ?? []) {
    const timestamp = new Date().toISOString();
    const { data: updated } = await supabase
      .from("invoices")
      .update({ status: "overdue", updated_at: timestamp })
      .eq("id", row.id)
      .eq("company_id", companyId)
      .eq("status", "sent")
      .select("id")
      .maybeSingle();

    if (!updated) continue;

    await supabase.from("invoice_history").insert({
      invoice_id: row.id,
      action: OVERDUE_HISTORY_ACTION,
      timestamp,
      user_name: "System",
      user_id: null,
    });
    promoted += 1;
  }

  const { data: overdueMissingHistory, error: overdueError } = await supabase
    .from("invoices")
    .select("id, invoice_history(id, action)")
    .eq("company_id", companyId)
    .eq("status", "overdue")
    .lt("due_date", now);

  if (overdueError) {
    throw new Error(overdueError.message);
  }

  for (const row of overdueMissingHistory ?? []) {
    const history = (row as { invoice_history: Array<{ action: string }> | null })
      .invoice_history;
    const hasEntry = (history ?? []).some(
      (entry) => entry.action === OVERDUE_HISTORY_ACTION
    );
    if (hasEntry) continue;

    const timestamp = new Date().toISOString();
    await supabase.from("invoice_history").insert({
      invoice_id: row.id,
      action: OVERDUE_HISTORY_ACTION,
      timestamp,
      user_name: "System",
      user_id: null,
    });
    promoted += 1;
  }

  return promoted;
}
