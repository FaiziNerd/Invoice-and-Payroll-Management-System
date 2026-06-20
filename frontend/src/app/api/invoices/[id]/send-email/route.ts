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
  buildInvoiceShareUrl,
  invoiceEmailHistoryAction,
} from "@/lib/invoices/email-content";
import {
  deliverInvoiceEmail,
  EmailDeliveryError,
  EmailNotConfiguredError,
} from "@/lib/server/send-invoice-email";
import { recordAuditLog } from "@/lib/server/record-audit-log";

export const runtime = "nodejs";

const WRITE_ROLES = ["admin", "accountant"] as const;

type RouteContext = { params: Promise<{ id: string }> };

type InvoiceWithRelations = InvoiceRow & {
  invoice_items: InvoiceItemRow[] | null;
  invoice_history: InvoiceHistoryRow[] | null;
};

type InvoiceWithClient = InvoiceWithRelations & {
  clients: { id: string; name: string; email: string } | null;
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

  const { data: row, error: fetchError } = await supabase
    .from("invoices")
    .select(
      "id, company_id, invoice_number, client_id, subtotal, tax_rate, tax_amount, total, status, template_id, share_token, issue_date, due_date, notes, created_at, updated_at, invoice_items(id, invoice_id, description, quantity, unit_price, amount), invoice_history(id, invoice_id, action, timestamp, user_id, user_name), clients(id, name, email)"
    )
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (fetchError) return fail("INTERNAL_ERROR", fetchError.message, 500);
  if (!row) return fail("NOT_FOUND", "Invoice not found", 404);

  const invoiceRow = row as InvoiceWithClient;
  const client = invoiceRow.clients;
  if (!client?.email) {
    return fail("VALIDATION_ERROR", "Client email address is required", 400);
  }

  const { data: settings } = await supabase
    .from("organization_settings")
    .select("name")
    .eq("company_id", companyId)
    .maybeSingle();

  const companyName = settings?.name?.trim() || "Your Company";
  const shareUrl = buildInvoiceShareUrl(invoiceRow.share_token);
  const mode = parsed.data.mode;

  try {
    const delivery = await deliverInvoiceEmail({
      invoiceNumber: invoiceRow.invoice_number,
      total: Number(invoiceRow.total),
      issueDate: invoiceRow.issue_date,
      dueDate: invoiceRow.due_date,
      notes: invoiceRow.notes,
      clientName: client.name,
      clientEmail: client.email,
      companyName,
      shareUrl,
      mode,
    });

    const historyAction = invoiceEmailHistoryAction(mode, client.email);
    const userName = parsed.data.userName?.trim() || "User";

    const { error: historyError } = await supabase.from("invoice_history").insert({
      invoice_id: id,
      action: historyAction,
      user_id: user.id,
      user_name: userName,
    });
    if (historyError) {
      return fail("INTERNAL_ERROR", historyError.message, 500);
    }

    if (mode === "send" && invoiceRow.status === "draft") {
      const { error: statusError } = await supabase
        .from("invoices")
        .update({ status: "sent", updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("company_id", companyId);
      if (statusError) {
        return fail("INTERNAL_ERROR", statusError.message, 500);
      }
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle();

    await recordAuditLog(supabase, {
      companyId,
      userId: user.id,
      userName: profile?.name ?? userName,
      action: "send",
      entity: "invoice",
      entityId: id,
      description: historyAction,
      metadata: { mode, resendId: delivery.id, clientEmail: client.email },
    });

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
    throw err;
  }
}
