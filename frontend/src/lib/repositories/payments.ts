import type { Payment, PaymentMethod } from "@/types";
import type { Invoice } from "@/types";
import { notifyDataChange } from "@/lib/data/events";
import { upsertInvoice } from "@/lib/repositories/invoices";

type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

async function parseApi<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiResult<T>;
  if (!json.success) {
    throw new Error(json.error?.message ?? "Request failed");
  }
  return json.data;
}

export async function fetchInvoicePayments(invoiceId: string): Promise<Payment[]> {
  const res = await fetch(`/api/invoices/${invoiceId}/payments`, {
    credentials: "include",
  });
  if (!res.ok) return [];
  return parseApi<Payment[]>(res);
}

export async function recordInvoicePayment(
  invoiceId: string,
  data: {
    amount: number;
    method: PaymentMethod;
    referenceNumber?: string;
    paymentDate: string;
    proofUrl?: string;
  }
): Promise<{ payment: Payment; invoice: Invoice }> {
  const res = await fetch(`/api/invoices/${invoiceId}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      amount: data.amount,
      method: data.method,
      referenceNumber: data.referenceNumber,
      paymentDate: data.paymentDate,
      proofUrl: data.proofUrl,
    }),
  });

  const result = await parseApi<{
    payment: Payment;
    invoice: {
      amountPaid: number;
      total: number;
      status: Invoice["status"];
      paymentVariance: Invoice["paymentVariance"];
    };
  }>(res);

  const cached = await fetch(`/api/invoices/${invoiceId}`, {
    credentials: "include",
  });
  const invoice = cached.ok ? await parseApi<Invoice>(cached) : null;

  if (invoice) {
    upsertInvoice(invoice);
    notifyDataChange("invoices");
    return { payment: result.payment, invoice };
  }

  throw new Error("Payment recorded but failed to refresh invoice");
}

export async function voidInvoice(
  invoiceId: string,
  reason: string
): Promise<void> {
  const res = await fetch(`/api/invoices/${invoiceId}/void`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ reason }),
  });

  await parseApi(res);

  const invoiceRes = await fetch(`/api/invoices/${invoiceId}`, {
    credentials: "include",
  });
  if (invoiceRes.ok) {
    const invoice = await parseApi<Invoice>(invoiceRes);
    upsertInvoice(invoice);
    notifyDataChange("invoices");
  }
}
