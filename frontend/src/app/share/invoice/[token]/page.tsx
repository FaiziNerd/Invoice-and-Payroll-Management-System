"use client";

import { use, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { InvoiceThemeView } from "@/components/invoices/invoice-theme-view";
import type { Client, Invoice, InvoiceTemplate } from "@/types";

type SharedInvoiceResponse = {
  invoice: {
    id: string;
    invoice_number: string;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    total: number;
    status: Invoice["status"];
    issue_date: string;
    due_date: string;
    notes?: string | null;
  };
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }>;
  client: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  template: {
    theme?: InvoiceTemplate["theme"];
    branding?: {
      logo?: string | null;
      primary_color?: string;
      secondary_color?: string;
      font_family?: string;
      sections?: {
        logo?: boolean;
        notes?: boolean;
        payment_terms?: boolean;
        footer?: boolean;
      };
      company_name?: string;
      company_address?: string;
      payment_terms?: string;
      footer_text?: string;
    };
  };
};

export default function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [invoice, setInvoice] = useState<Invoice | undefined>(undefined);
  const [client, setClient] = useState<Client | undefined>(undefined);
  const [template, setTemplate] = useState<InvoiceTemplate | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    void fetch(`/api/shared/invoice/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) return null;
        const json = (await res.json()) as {
          success: boolean;
          data?: SharedInvoiceResponse;
        };
        if (!json.success || !json.data) return null;
        return json.data;
      })
      .then((payload) => {
        if (!mounted || !payload) {
          setInvoice(undefined);
          setClient(undefined);
          setTemplate(undefined);
          return;
        }

        const mappedInvoice: Invoice = {
          id: String(payload.invoice.id),
          invoiceNumber: String(payload.invoice.invoice_number),
          clientId: "public-client",
          items: (payload.items ?? []).map((item) => ({
            id: String(item.id),
            description: String(item.description ?? ""),
            quantity: Number(item.quantity ?? 0),
            unitPrice: Number(item.unit_price ?? 0),
            amount: Number(item.amount ?? 0),
          })),
          subtotal: Number(payload.invoice.subtotal ?? 0),
          taxRate: Number(payload.invoice.tax_rate ?? 0),
          taxAmount: Number(payload.invoice.tax_amount ?? 0),
          total: Number(payload.invoice.total ?? 0),
          status: payload.invoice.status,
          templateId: "public-template",
          shareToken: token,
          issueDate: String(payload.invoice.issue_date),
          dueDate: String(payload.invoice.due_date),
          notes: payload.invoice.notes ?? undefined,
          history: [],
          createdAt: String(payload.invoice.issue_date),
          updatedAt: String(payload.invoice.issue_date),
        };

        const mappedClient: Client = {
          id: "public-client",
          name: String(payload.client?.name ?? ""),
          email: String(payload.client?.email ?? ""),
          phone: String(payload.client?.phone ?? ""),
          address: String(payload.client?.address ?? ""),
          createdAt: String(payload.invoice.issue_date),
        };

        const mappedTemplate: InvoiceTemplate = {
          id: "public-template",
          name: "Shared Template",
          isDefault: false,
          isActive: true,
          theme: payload.template?.theme ?? "classic",
          branding: {
            logo: payload.template?.branding?.logo ?? undefined,
            primaryColor: payload.template?.branding?.primary_color ?? "#2563eb",
            secondaryColor: payload.template?.branding?.secondary_color ?? "#64748b",
            fontFamily: payload.template?.branding?.font_family ?? "Inter",
            sections: {
              logo: Boolean(payload.template?.branding?.sections?.logo),
              notes: Boolean(payload.template?.branding?.sections?.notes),
              paymentTerms: Boolean(payload.template?.branding?.sections?.payment_terms),
              footer: Boolean(payload.template?.branding?.sections?.footer),
            },
            companyName: payload.template?.branding?.company_name ?? "My Company",
            companyAddress: payload.template?.branding?.company_address ?? "",
            paymentTerms: payload.template?.branding?.payment_terms ?? "",
            footerText: payload.template?.branding?.footer_text ?? "",
          },
          createdAt: String(payload.invoice.issue_date),
          updatedAt: String(payload.invoice.issue_date),
        };

        setInvoice(mappedInvoice);
        setClient(mappedClient);
        setTemplate(mappedTemplate);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [token]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Loading invoice...</p>
      </div>
    );
  }

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
