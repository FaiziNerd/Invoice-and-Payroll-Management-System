import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { syncInvoicePaymentState } from "@/lib/api/invoices/payments";
import { auditMutation, getActorName } from "@/lib/server/audit-helpers";

const WRITE_ROLES = ["admin", "accountant"] as const;

const recordPaymentSchema = z.object({
  amount: z.number().finite().positive("Amount must be greater than 0"),
  method: z.enum(["bank_transfer", "cash", "gateway"]),
  referenceNumber: z.string().trim().optional(),
  paymentDate: z.string().trim().min(1, "Payment date is required"),
  proofUrl: z.string().url().optional().or(z.literal("")),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { id: invoiceId } = await params;
  const result = await requireCompanyContext();
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, company_id, invoice_id, amount, method, reference_number, payment_date, recorded_by, proof_url, created_at, profiles:recorded_by(name)"
    )
    .eq("invoice_id", invoiceId)
    .eq("company_id", companyId)
    .order("payment_date", { ascending: false });

  if (error) return fail("INTERNAL_ERROR", error.message, 500);

  const payments = (data ?? []).map((row) => ({
    id: row.id,
    invoiceId: row.invoice_id,
    amount: Number(row.amount),
    method: row.method,
    referenceNumber: row.reference_number ?? undefined,
    paymentDate: row.payment_date,
    recordedBy: row.recorded_by,
    recordedByName:
      (row.profiles as { name?: string } | null)?.name ?? "Unknown",
    proofUrl: row.proof_url ?? undefined,
    createdAt: row.created_at,
  }));

  return ok(payments);
}

export async function POST(request: Request, { params }: RouteContext) {
  const { id: invoiceId } = await params;
  const result = await requireCompanyContext({ roles: [...WRITE_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId, user } = result.ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION_ERROR", "Invalid JSON body", 400);
  }

  const parsed = recordPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.errors[0]?.message ?? "Invalid input",
      400
    );
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, status, total, amount_paid, invoice_number")
    .eq("id", invoiceId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (invoiceError) return fail("INTERNAL_ERROR", invoiceError.message, 500);
  if (!invoice) return fail("NOT_FOUND", "Invoice not found", 404);

  if (invoice.status === "draft") {
    return fail(
      "VALIDATION_ERROR",
      "Cannot record payments against draft invoices. Send the invoice first.",
      400
    );
  }

  if (invoice.status === "void") {
    return fail("VALIDATION_ERROR", "Cannot record payments against void invoices.", 400);
  }

  if (invoice.status === "paid") {
    return fail(
      "VALIDATION_ERROR",
      "Invoice is already fully paid.",
      400
    );
  }

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      company_id: companyId,
      invoice_id: invoiceId,
      amount: parsed.data.amount,
      method: parsed.data.method,
      reference_number: parsed.data.referenceNumber || null,
      payment_date: parsed.data.paymentDate,
      recorded_by: user.id,
      proof_url: parsed.data.proofUrl || null,
    })
    .select("id, amount, method, reference_number, payment_date, proof_url, created_at")
    .single();

  if (paymentError) return fail("INTERNAL_ERROR", paymentError.message, 500);

  let sync;
  try {
    sync = await syncInvoicePaymentState(supabase, invoiceId, companyId);
  } catch (err) {
    return fail(
      "INTERNAL_ERROR",
      err instanceof Error ? err.message : "Failed to sync payment state",
      500
    );
  }

  const actorName = await getActorName(supabase, user.id);

  await supabase.from("invoice_history").insert({
    invoice_id: invoiceId,
    action: `Payment recorded: ${parsed.data.method} ${parsed.data.amount}`,
    user_id: user.id,
    user_name: actorName,
  });

  await auditMutation(supabase, {
    companyId,
    userId: user.id,
    userName: actorName,
    action: "payment",
    entity: "invoice",
    entityId: invoiceId,
    description: `Recorded ${parsed.data.amount} payment on ${invoice.invoice_number}`,
    metadata: {
      paymentId: payment.id,
      amount: parsed.data.amount,
      method: parsed.data.method,
      before: { amountPaid: Number(invoice.amount_paid), status: invoice.status },
      after: { amountPaid: sync.amountPaid, status: sync.status },
      paymentVariance: sync.paymentVariance,
    },
  });

  return ok(
    {
      payment: {
        id: payment.id,
        amount: Number(payment.amount),
        method: payment.method,
        referenceNumber: payment.reference_number ?? undefined,
        paymentDate: payment.payment_date,
        proofUrl: payment.proof_url ?? undefined,
        createdAt: payment.created_at,
      },
      invoice: {
        amountPaid: sync.amountPaid,
        total: sync.invoiceTotal,
        status: sync.status,
        paymentVariance: sync.paymentVariance,
      },
    },
    201
  );
}
