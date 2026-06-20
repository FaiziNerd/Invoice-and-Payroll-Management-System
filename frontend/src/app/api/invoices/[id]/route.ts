import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { updateInvoiceSchema } from "@/lib/api/invoices/schemas";
import { normalizeLineItems } from "@/lib/api/invoices/utils";
import {
  INVOICE_SELECT,
  rowToInvoice,
  type InvoiceHistoryRow,
  type InvoiceItemRow,
  type InvoiceRow,
} from "@/lib/api/invoices/mappers";
import {
  calculateTaxTotals,
  defaultTaxConfig,
  getActiveOrgTaxConfig,
} from "@/lib/api/tax/config";
import { auditMutation, buildDiff, getActorName } from "@/lib/server/audit-helpers";
import type { InvoiceStatus } from "@/types";

const WRITE_ROLES = ["admin", "accountant"] as const;

type RouteContext = { params: Promise<{ id: string }> };

type InvoiceWithRelations = InvoiceRow & {
  invoice_items: InvoiceItemRow[] | null;
  invoice_history: InvoiceHistoryRow[] | null;
};

const ITEMS_HISTORY_SELECT =
  ", invoice_items(id, invoice_id, description, quantity, unit_price, amount), invoice_history(id, invoice_id, action, timestamp, user_id, user_name)";

function mapInvoice(row: InvoiceWithRelations) {
  return rowToInvoice(
    row,
    (row.invoice_items ?? []).sort((a, b) => a.id.localeCompare(b.id)),
    (row.invoice_history ?? []).sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    )
  );
}

const ISSUED_STATUSES = new Set<InvoiceStatus>([
  "sent",
  "partially_paid",
  "paid",
  "overdue",
  "void",
]);

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const result = await requireCompanyContext();
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT + ITEMS_HISTORY_SELECT)
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) return fail("INTERNAL_ERROR", error.message, 500);
  if (!data) return fail("NOT_FOUND", "Invoice not found", 404);

  return ok(mapInvoice(data as unknown as InvoiceWithRelations));
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
      parsed.error.errors[0]?.message ?? "Invalid input",
      400
    );
  }

  if (parsed.data.status === "paid" || parsed.data.status === "partially_paid") {
    return fail(
      "VALIDATION_ERROR",
      "Paid status is set automatically when payments are recorded.",
      400
    );
  }

  const currentResult = await supabase
    .from("invoices")
    .select(INVOICE_SELECT + ITEMS_HISTORY_SELECT)
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (currentResult.error) {
    return fail("INTERNAL_ERROR", currentResult.error.message, 500);
  }
  if (!currentResult.data) return fail("NOT_FOUND", "Invoice not found", 404);

  const current = mapInvoice(currentResult.data as unknown as InvoiceWithRelations);

  if (ISSUED_STATUSES.has(current.status) && parsed.data.items) {
    return fail(
      "VALIDATION_ERROR",
      "Line items cannot be edited after an invoice is issued.",
      400
    );
  }

  if (current.status === "void") {
    return fail("VALIDATION_ERROR", "Void invoices cannot be edited.", 400);
  }

  const nextItems = parsed.data.items
    ? normalizeLineItems(parsed.data.items)
    : current.items;

  const taxConfig =
    (await getActiveOrgTaxConfig(supabase, companyId)) ??
    defaultTaxConfig(companyId);
  const nextTaxRate = parsed.data.taxRate ?? current.taxRate ?? taxConfig.rate;
  const lineSubtotal = nextItems.reduce((sum, item) => sum + item.amount, 0);
  const totals = calculateTaxTotals(lineSubtotal, {
    ...taxConfig,
    rate: nextTaxRate,
  });

  const updates: Record<string, string | number | null> = {
    updated_at: new Date().toISOString(),
  };
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
    .select(INVOICE_SELECT)
    .single<InvoiceRow>();

  if (updateError) return fail("INTERNAL_ERROR", updateError.message, 500);

  if (parsed.data.items !== undefined) {
    const { error: deleteItemsError } = await supabase
      .from("invoice_items")
      .delete()
      .eq("invoice_id", id);
    if (deleteItemsError) {
      return fail("INTERNAL_ERROR", deleteItemsError.message, 500);
    }

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
      if (insertItemsError) {
        return fail("INTERNAL_ERROR", insertItemsError.message, 500);
      }
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
    .select(INVOICE_SELECT + ITEMS_HISTORY_SELECT)
    .eq("id", id)
    .eq("company_id", companyId)
    .single();

  if (fullError || !fullData) {
    return ok(rowToInvoice(invoiceRow, [], []));
  }

  const updated = mapInvoice(fullData as unknown as InvoiceWithRelations);
  const actorName = await getActorName(
    supabase,
    user.id,
    parsed.data.userName ?? "User"
  );

  await auditMutation(supabase, {
    companyId,
    userId: user.id,
    userName: actorName,
    action: "update",
    entity: "invoice",
    entityId: id,
    description: historyAction || `Updated invoice ${updated.invoiceNumber}`,
    metadata: buildDiff(
      {
        subtotal: current.subtotal,
        taxRate: current.taxRate,
        taxAmount: current.taxAmount,
        total: current.total,
        status: current.status,
      },
      {
        subtotal: updated.subtotal,
        taxRate: updated.taxRate,
        taxAmount: updated.taxAmount,
        total: updated.total,
        status: updated.status,
      }
    ),
  });

  return ok(updated);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const result = await requireCompanyContext({ roles: [...WRITE_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId, user } = result.ctx;

  const { data: invoice, error: fetchError } = await supabase
    .from("invoices")
    .select("id, status, invoice_number")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (fetchError) return fail("INTERNAL_ERROR", fetchError.message, 500);
  if (!invoice) return fail("NOT_FOUND", "Invoice not found", 404);

  if (invoice.status !== "draft") {
    return fail(
      "VALIDATION_ERROR",
      "Issued invoices cannot be deleted. Void the invoice instead.",
      400
    );
  }

  const { data, error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId)
    .select("id")
    .maybeSingle();

  if (error) return fail("INTERNAL_ERROR", error.message, 500);
  if (!data) return fail("NOT_FOUND", "Invoice not found", 404);

  const actorName = await getActorName(supabase, user.id);
  await auditMutation(supabase, {
    companyId,
    userId: user.id,
    userName: actorName,
    action: "delete",
    entity: "invoice",
    entityId: id,
    description: `Deleted draft invoice ${invoice.invoice_number}`,
  });

  return ok({ deleted: true });
}
