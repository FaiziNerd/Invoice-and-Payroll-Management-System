"use client";

import { use, useMemo } from "react";
import { getInvoiceByToken } from "@/lib/mock-db/invoices";
import { getClientById } from "@/lib/mock-db/clients";
import { getTemplateById } from "@/lib/mock-db/templates";
import { Card, CardContent } from "@/components/ui/card";
import { InvoiceThemeView } from "@/components/invoices/invoice-theme-view";

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

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardContent className="p-6 md:p-10">
            <InvoiceThemeView
              invoice={invoice}
              client={client}
              template={template}
              showStatus
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
