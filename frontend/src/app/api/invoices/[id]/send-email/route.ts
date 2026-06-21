import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { sendInvoiceEmailSchema } from "@/lib/api/invoices/send-email-schema";
import {
  rowToInvoice,
  type InvoiceHistoryRow,
  type InvoiceItemRow,
  type InvoiceRow,
} from "@/lib/api/invoices/mappers";
import {
  sendInvoiceEmailAction,
  EmailDeliveryError,
  EmailNotConfiguredError,
} from "@/lib/server/send-invoice-email-action";

export const runtime = "nodejs";

const WRITE_ROLES = ["admin", "accountant"] as const;

type RouteContext = { params: Promise<{ id: string }> };

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

export async function POST(request: Request, { params }: RouteContext) {
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

  const parsed = sendInvoiceEmailSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid input",
      400
    );
  }

  const userName = parsed.data.userName?.trim() || "User";

  try {
    await sendInvoiceEmailAction(
      supabase,
      companyId,
      id,
      user.id,
      userName,
      parsed.data.mode
    );

    const { data: fullData, error: fullError } = await supabase
      .from("invoices")
      .select(
        "id, company_id, invoice_number, client_id, subtotal, tax_rate, tax_amount, total, status, template_id, share_token, issue_date, due_date, notes, created_at, updated_at, invoice_items(id, invoice_id, description, quantity, unit_price, amount), invoice_history(id, invoice_id, action, timestamp, user_id, user_name)"
      )
      .eq("id", id)
      .eq("company_id", companyId)
      .single();

    if (fullError || !fullData) {
      return fail("INTERNAL_ERROR", "Invoice updated but could not be reloaded", 500);
    }

    return ok(mapInvoice(fullData as InvoiceWithRelations));
  } catch (err) {
    if (err instanceof EmailNotConfiguredError) {
      return fail("INTERNAL_ERROR", err.message, 503);
    }
    if (err instanceof EmailDeliveryError) {
      return fail("INTERNAL_ERROR", `Failed to send email: ${err.message}`, 502);
    }
    if (err instanceof Error && err.message === "Client email address is required") {
      return fail("VALIDATION_ERROR", err.message, 400);
    }
    if (err instanceof Error && err.message === "Invoice not found") {
      return fail("NOT_FOUND", err.message, 404);
    }
    throw err;
  }
}
