"use client";

import { use, useMemo } from "react";
import Image from "next/image";
import { getInvoiceByToken } from "@/lib/mock-db/invoices";
import { getClientById } from "@/lib/mock-db/clients";
import { getTemplateById } from "@/lib/mock-db/templates";
import { formatCurrency, formatDate } from "@/lib/utils";
import { InvoiceStatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";

export default function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const invoice = useMemo(() => getInvoiceByToken(token), [token]);
  const client = useMemo(() => (invoice ? getClientById(invoice.clientId) : undefined), [invoice]);
  const template = useMemo(() => (invoice ? getTemplateById(invoice.templateId) : undefined), [invoice]);

  if (!invoice || !client) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-muted-foreground">Invoice not found or link has expired.</p>
      </div>
    );
  }

  const primaryColor = template?.branding.primaryColor || "#2563eb";

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardContent className="p-6 md:p-10">
            <div className="flex justify-between items-start border-b-2 pb-6 mb-6" style={{ borderColor: primaryColor }}>
              <div>
                {template?.branding.logo && (
                  <Image
                    src={template.branding.logo}
                    alt="Logo"
                    width={48}
                    height={48}
                    unoptimized
                    className="h-12 w-auto mb-2"
                  />
                )}
                <h1 className="text-xl font-bold" style={{ color: primaryColor }}>
                  {template?.branding.companyName || "DotCode Solutions"}
                </h1>
                <p className="text-sm text-muted-foreground">{template?.branding.companyAddress}</p>
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-bold" style={{ color: primaryColor }}>INVOICE</h2>
                <p className="font-medium">{invoice.invoiceNumber}</p>
                <InvoiceStatusBadge status={invoice.status} />
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 mb-8">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Bill To</p>
                <p className="font-semibold">{client.name}</p>
                <p className="text-sm">{client.email}</p>
                <p className="text-sm">{client.address}</p>
              </div>
              <div className="text-right sm:text-left">
                <p className="text-sm">Issued: {formatDate(invoice.issueDate)}</p>
                <p className="text-sm">Due: {formatDate(invoice.dueDate)}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: primaryColor }} className="text-white">
                    <th className="p-2 text-left">Description</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-right">Price</th>
                    <th className="p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-2">{item.description}</td>
                      <td className="p-2 text-right">{item.quantity}</td>
                      <td className="p-2 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="p-2 text-right">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex flex-col items-end gap-1 text-sm">
              <div className="flex gap-8"><span>Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span></div>
              <div className="flex gap-8"><span>Tax</span><span>{formatCurrency(invoice.taxAmount)}</span></div>
              <div className="flex gap-8 text-lg font-bold" style={{ color: primaryColor }}>
                <span>Total</span><span>{formatCurrency(invoice.total)}</span>
              </div>
            </div>

            {template?.branding.sections.footer && (
              <p className="mt-8 text-center text-xs text-muted-foreground">
                {template.branding.footerText}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
