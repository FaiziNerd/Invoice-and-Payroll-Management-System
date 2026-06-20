import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { updateInvoiceSchema } from "@/lib/api/invoices/schemas";
import {
  calculateInvoiceTotals,
  normalizeLineItems,
} from "@/lib/api/invoices/utils";
import {
  rowToInvoice,
  type InvoiceHistoryRow,
  type InvoiceItemRow,
  type InvoiceRow,
} from "@/lib/api/invoices/mappers";

const WRITE_ROLES = ["admin", "accountant"] as const;

type RouteContext = { params: Promise<{ id: string }> };

type InvoiceWithRelations = InvoiceRow & {
  invoice_items: InvoiceItemRow[] | null;
  invoice_history: InvoiceHistoryRow[] | null;
};

function mapInvoice(row: InvoiceWithRelations) {
  return rowToInvoice(
    row,
    (row.invoice_items ?? []).sort((a, b) =>
      a.id.localeCompare(b.id)
    ),
    (row.invoice_history ?? []).sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    )
  );
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const result = await requireCompanyContext();
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, company_id, invoice_number, client_id, subtotal, tax_rate, tax_amount, total, status, template_id, share_token, issue_date, due_date, notes, created_at, updated_at, invoice_items(id, invoice_id, description, quantity, unit_price, amount), invoice_history(id, invoice_id, action, timestamp, user_id, user_name)"
    )
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) return fail("INTERNAL_ERROR", error.message, 500);
  if (!data) return fail("NOT_FOUND", "Invoice not found", 404);

  return ok(mapInvoice(data as InvoiceWithRelations));
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const result = await requireCompanyContext({ roles: [...WRITE_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId, user } = result.ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION_ERROR", "Invalid JSON body", 400);
  }

  const parsed = updateInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid input",
      400
    );
  }

  const currentResult = await supabase
    .from("invoices")
    .select(
      "id, company_id, invoice_number, client_id, subtotal, tax_rate, tax_amount, total, status, template_id, share_token, issue_date, due_date, notes, created_at, updated_at, invoice_items(id, invoice_id, description, quantity, unit_price, amount), invoice_history(id, invoice_id, action, timestamp, user_id, user_name)"
    )
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (currentResult.error) return fail("INTERNAL_ERROR", currentResult.error.message, 500);
  if (!currentResult.data) return fail("NOT_FOUND", "Invoice not found", 404);

  const current = mapInvoice(currentResult.data as InvoiceWithRelations);
  const nextItems = parsed.data.items
    ? normalizeLineItems(parsed.data.items)
    : current.items;
  const nextTaxRate = parsed.data.taxRate ?? current.taxRate;
  const totals = calculateInvoiceTotals(nextItems, nextTaxRate);

  const updates: Record<string, string | number | null> = { updated_at: new Date().toISOString() };
  if (parsed.data.invoiceNumber !== undefined) updates.invoice_number = parsed.data.invoiceNumber;
  if (parsed.data.clientId !== undefined) updates.client_id = parsed.data.clientId;
  if (parsed.data.taxRate !== undefined) updates.tax_rate = parsed.data.taxRate;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.templateId !== undefined) updates.template_id = parsed.data.templateId;
  if (parsed.data.issueDate !== undefined) updates.issue_date = parsed.data.issueDate;
  if (parsed.data.dueDate !== undefined) updates.due_date = parsed.data.dueDate;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes || null;

  if (parsed.data.items !== undefined || parsed.data.taxRate !== undefined) {
    updates.subtotal = totals.subtotal;
    updates.tax_amount = totals.taxAmount;
    updates.total = totals.total;
  }

  const { data: invoiceRow, error: updateError } = await supabase
    .from("invoices")
    .update(updates)
    .eq("id", id)
    .eq("company_id", companyId)
    .select(
      "id, company_id, invoice_number, client_id, subtotal, tax_rate, tax_amount, total, status, template_id, share_token, issue_date, due_date, notes, created_at, updated_at"
    )
    .single<InvoiceRow>();

  if (updateError) return fail("INTERNAL_ERROR", updateError.message, 500);

  if (parsed.data.items !== undefined) {
    const { error: deleteItemsError } = await supabase
      .from("invoice_items")
      .delete()
      .eq("invoice_id", id);
    if (deleteItemsError) return fail("INTERNAL_ERROR", deleteItemsError.message, 500);

    if (parsed.data.items.length > 0) {
      const { error: insertItemsError } = await supabase.from("invoice_items").insert(
        parsed.data.items.map((item) => ({
          invoice_id: id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          amount: item.amount,
        }))
      );
      if (insertItemsError) return fail("INTERNAL_ERROR", insertItemsError.message, 500);
    }
  }

  const historyAction = parsed.data.historyAction;
  if (historyAction) {
    const { error: historyError } = await supabase.from("invoice_history").insert({
      invoice_id: id,
      action: historyAction,
      user_id: user.id,
      user_name: parsed.data.userName || "User",
    });
    if (historyError) return fail("INTERNAL_ERROR", historyError.message, 500);
  }

  const { data: fullData, error: fullError } = await supabase
    .from("invoices")
    .select(
      "id, company_id, invoice_number, client_id, subtotal, tax_rate, tax_amount, total, status, template_id, share_token, issue_date, due_date, notes, created_at, updated_at, invoice_items(id, invoice_id, description, quantity, unit_price, amount), invoice_history(id, invoice_id, action, timestamp, user_id, user_name)"
    )
    .eq("id", id)
    .eq("company_id", companyId)
    .single();

  if (fullError || !fullData) {
    return ok(
      rowToInvoice(
        invoiceRow,
        [],
        []
      )
    );
  }

  return ok(mapInvoice(fullData as InvoiceWithRelations));
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const result = await requireCompanyContext({ roles: [...WRITE_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  const { data, error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId)
    .select("id")
    .maybeSingle();

  if (error) return fail("INTERNAL_ERROR", error.message, 500);
  if (!data) return fail("NOT_FOUND", "Invoice not found", 404);

  return ok({ deleted: true });
}
