import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { createInvoiceSchema } from "@/lib/api/invoices/schemas";
import {
  INVOICE_SELECT,
  invoiceInsertToRow,
  rowToInvoice,
  type InvoiceHistoryRow,
  type InvoiceItemRow,
  type InvoiceRow,
} from "@/lib/api/invoices/mappers";
import { normalizeLineItems } from "@/lib/api/invoices/utils";
import { allocateNextInvoiceNumber } from "@/lib/api/invoices/numbering";
import {
  calculateTaxTotals,
  defaultTaxConfig,
  getActiveOrgTaxConfig,
} from "@/lib/api/tax/config";
import { generateSecureShareToken } from "@/lib/server/tokens";
import { auditMutation, getActorName } from "@/lib/server/audit-helpers";
import {
  applyCursorFilter,
  buildPaginatedResponse,
  parseListParams,
} from "@/lib/api/pagination";

const WRITE_ROLES = ["admin", "accountant"] as const;

type InvoiceWithRelations = InvoiceRow & {
  invoice_items: InvoiceItemRow[] | null;
  invoice_history: InvoiceHistoryRow[] | null;
};

function mapInvoice(row: InvoiceWithRelations) {
  return rowToInvoice(
    row,
    (row.invoice_items ?? []).sort((a, b) => a.id.localeCompare(b.id)),
    (row.invoice_history ?? []).sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp)
    )
  );
}

const ITEMS_HISTORY_SELECT =
  ", invoice_items(id, invoice_id, description, quantity, unit_price, amount), invoice_history(id, invoice_id, action, timestamp, user_id, user_name)";

export async function GET(request: Request) {
  const result = await requireCompanyContext();
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  const url = new URL(request.url);
  const { limit, cursor } = parseListParams(url);

  let query = supabase
    .from("invoices")
    .select(INVOICE_SELECT + ITEMS_HISTORY_SELECT)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  query = applyCursorFilter(query, cursor);

  const { data, error } = await query;

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  const mapped = ((data ?? []) as unknown as InvoiceWithRelations[]).map(mapInvoice);
  return ok(buildPaginatedResponse(mapped, limit));
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

  if (parsed.data.status === "paid" || parsed.data.status === "partially_paid") {
    return fail(
      "VALIDATION_ERROR",
      "Paid status is set automatically when payments are recorded.",
      400
    );
  }

  const items = normalizeLineItems(parsed.data.items);
  const lineSubtotal = items.reduce((sum, item) => sum + item.amount, 0);

  const taxConfig =
    (await getActiveOrgTaxConfig(supabase, companyId)) ??
    defaultTaxConfig(companyId);

  const taxRate = parsed.data.taxRate ?? taxConfig.rate;
  const totals = calculateTaxTotals(lineSubtotal, {
    ...taxConfig,
    rate: taxRate,
  });

  let invoiceNumber: string;
  try {
    invoiceNumber = await allocateNextInvoiceNumber(supabase, companyId);
  } catch (err) {
    return fail(
      "INTERNAL_ERROR",
      err instanceof Error ? err.message : "Failed to allocate invoice number",
      500
    );
  }

  const shareToken = generateSecureShareToken();

  const { data: invoiceRow, error: invoiceError } = await supabase
    .from("invoices")
    .insert(
      invoiceInsertToRow({
        companyId,
        invoiceNumber,
        clientId: parsed.data.clientId,
        subtotal: totals.subtotal,
        taxRate: totals.taxRate,
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
    .select(INVOICE_SELECT)
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

  const actorName = await getActorName(
    supabase,
    user.id,
    parsed.data.userName ?? "User"
  );

  await auditMutation(supabase, {
    companyId,
    userId: user.id,
    userName: actorName,
    action: "create",
    entity: "invoice",
    entityId: invoice.id,
    description: `Created invoice ${invoice.invoiceNumber}`,
    metadata: {
      after: {
        total: invoice.total,
        taxRate: invoice.taxRate,
        status: invoice.status,
      },
    },
  });

  return ok(invoice, 201);
}
