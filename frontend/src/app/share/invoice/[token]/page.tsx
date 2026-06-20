"use client";

import { use, useMemo } from "react";
import { getInvoiceByToken } from "@/lib/mock-db/invoices";
import { findClientById } from "@/lib/mock-db/clients";
import { findTemplateById } from "@/lib/mock-db/templates";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { InvoiceThemeView } from "@/components/invoices/invoice-theme-view";

export default function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const invoice = useMemo(() => getInvoiceByToken(token), [token]);
  const client = useMemo(() => (invoice ? findClientById(invoice.clientId) : undefined), [invoice]);
  const template = useMemo(() => (invoice ? findTemplateById(invoice.templateId) : undefined), [invoice]);

  if (!invoice || !client) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <EmptyState
          icon="file"
          title="Invoice not found"
          description="This invoice may have been removed or the share link has expired."
        />
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
