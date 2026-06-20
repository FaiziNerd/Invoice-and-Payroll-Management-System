import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { createInvoiceSchema } from "@/lib/api/invoices/schemas";
import {
  invoiceInsertToRow,
  rowToInvoice,
  type InvoiceHistoryRow,
  type InvoiceItemRow,
  type InvoiceRow,
} from "@/lib/api/invoices/mappers";
import {
  calculateInvoiceTotals,
  normalizeLineItems,
} from "@/lib/api/invoices/utils";
import { generateSecureShareToken } from "@/lib/server/tokens";
import { recordAuditLog } from "@/lib/server/record-audit-log";

const WRITE_ROLES = ["admin", "accountant"] as const;

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

export async function GET() {
  const result = await requireCompanyContext();
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, company_id, invoice_number, client_id, subtotal, tax_rate, tax_amount, total, status, template_id, share_token, issue_date, due_date, notes, created_at, updated_at, invoice_items(id, invoice_id, description, quantity, unit_price, amount), invoice_history(id, invoice_id, action, timestamp, user_id, user_name)"
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  const invoices = ((data ?? []) as InvoiceWithRelations[]).map(mapInvoice);
  return ok(invoices);
}

export async function POST(request: Request) {
  const result = await requireCompanyContext({ roles: [...WRITE_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId, user } = result.ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION_ERROR", "Invalid JSON body", 400);
  }

  const parsed = createInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.errors[0]?.message ?? "Invalid input",
      400
    );
  }

  const items = normalizeLineItems(parsed.data.items);
  const totals = calculateInvoiceTotals(items, parsed.data.taxRate);
  const shareToken = generateSecureShareToken();

  const { data: invoiceRow, error: invoiceError } = await supabase
    .from("invoices")
    .insert(
      invoiceInsertToRow({
        companyId,
        invoiceNumber: parsed.data.invoiceNumber,
        clientId: parsed.data.clientId,
        subtotal: totals.subtotal,
        taxRate: parsed.data.taxRate,
        taxAmount: totals.taxAmount,
        total: totals.total,
        status: parsed.data.status,
        templateId: parsed.data.templateId,
        shareToken,
        issueDate: parsed.data.issueDate,
        dueDate: parsed.data.dueDate,
        notes: parsed.data.notes,
      })
    )
    .select(
      "id, company_id, invoice_number, client_id, subtotal, tax_rate, tax_amount, total, status, template_id, share_token, issue_date, due_date, notes, created_at, updated_at"
    )
    .single<InvoiceRow>();

  if (invoiceError) {
    return fail("INTERNAL_ERROR", invoiceError.message, 500);
  }

  const { data: itemRows, error: itemError } = await supabase
    .from("invoice_items")
    .insert(
      items.map((item) => ({
        invoice_id: invoiceRow.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        amount: item.amount,
      }))
    )
    .select("id, invoice_id, description, quantity, unit_price, amount");

  if (itemError) {
    return fail("INTERNAL_ERROR", itemError.message, 500);
  }

  const createdAction = parsed.data.historyAction || "Invoice created";
  const { data: historyRows, error: historyError } = await supabase
    .from("invoice_history")
    .insert({
      invoice_id: invoiceRow.id,
      action: createdAction,
      user_id: user.id,
      user_name: parsed.data.userName || "User",
    })
    .select("id, invoice_id, action, timestamp, user_id, user_name");

  if (historyError) {
    return fail("INTERNAL_ERROR", historyError.message, 500);
  }

  const invoice = rowToInvoice(
    invoiceRow,
    (itemRows ?? []) as InvoiceItemRow[],
    (historyRows ?? []) as InvoiceHistoryRow[]
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  await recordAuditLog(supabase, {
    companyId,
    userId: user.id,
    userName: profile?.name ?? parsed.data.userName ?? "User",
    action: "create",
    entity: "invoice",
    entityId: invoice.id,
    description: `Created invoice ${invoice.invoiceNumber}`,
  });

  return ok(invoice, 201);
}
