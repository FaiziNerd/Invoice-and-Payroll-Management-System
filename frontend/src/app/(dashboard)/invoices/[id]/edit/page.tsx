"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { InvoiceForm, invoiceToFormValues } from "@/components/invoices/invoice-form";
import type { InvoiceFormValues } from "@/components/invoices/invoice-form";
import {
  fetchInvoiceById,
  getInvoiceById,
  updateInvoice,
} from "@/lib/repositories/invoices";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import { RoleGate } from "@/components/auth/role-gate";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { session } = useAuth();
  const [invoice, setInvoice] = useState(() => getInvoiceById(id));
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(true);

  useEffect(() => {
    let mounted = true;
    setIsLoadingInvoice(true);
    void fetchInvoiceById(id)
      .then((next) => {
        if (mounted) setInvoice(next);
      })
      .finally(() => {
        if (mounted) setIsLoadingInvoice(false);
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  if (isLoadingInvoice) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading invoice...</div>;
  }

  if (!invoice) {
    return (
      <RoleGate roles={["admin", "accountant"]}>
        <EmptyState
          icon="file"
          title="Invoice not found"
          description="This invoice may have been deleted or the link is invalid."
          action={
            <Button asChild>
              <Link href="/invoices">Back to Invoices</Link>
            </Button>
          }
        />
      </RoleGate>
    );
  }

  if (invoice.status === "paid") {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-muted-foreground">Paid invoices cannot be edited.</p>
        <button
          type="button"
          className="text-primary hover:underline"
          onClick={() => router.push(`/invoices/${id}`)}
        >
          Back to invoice
        </button>
      </div>
    );
  }

  const handleSubmit = async (values: InvoiceFormValues) => {
    if (!session || !values.clientId) {
      toast.error("Please select a client");
      return;
    }
    if (values.items.length === 0) {
      toast.error("Add at least one line item");
      return;
    }
    try {
      await updateInvoice(
        id,
        {
          clientId: values.clientId,
          templateId: values.templateId,
          items: values.items,
          taxRate: values.taxRate,
          dueDate: new Date(values.dueDate).toISOString(),
          notes: values.notes,
        },
        session.userId,
        session.name,
        "Invoice updated"
      );
      toast.success("Invoice updated");
      router.push(`/invoices/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update invoice");
    }
  };

  return (
    <RoleGate roles={["admin", "accountant"]}>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Invoices", href: "/invoices" },
            { label: invoice.invoiceNumber, href: `/invoices/${id}` },
            { label: "Edit" },
          ]}
        />
        <PageHeader
          title={`Edit ${invoice.invoiceNumber}`}
          description="Update invoice details and line items"
        />
        <InvoiceForm
          initialValues={invoiceToFormValues(invoice)}
          submitLabel="Save Changes"
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/invoices/${id}`)}
        />
      </div>
    </RoleGate>
  );
}
