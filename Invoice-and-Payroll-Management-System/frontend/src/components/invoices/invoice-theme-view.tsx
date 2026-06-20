"use client";

import Image from "next/image";
import type { Client, Invoice, InvoiceTemplate } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { InvoiceStatusBadge } from "@/components/shared/status-badge";
import { getOrganizationAddress, getOrganizationCompanyName } from "@/lib/repositories/settings";
import { DEFAULT_COMPANY_PLACEHOLDER } from "@/lib/branding";

type InvoiceTheme = InvoiceTemplate["theme"];

interface InvoiceThemeViewProps {
  invoice: Invoice;
  client: Client;
  template?: InvoiceTemplate;
  compact?: boolean;
  showStatus?: boolean;
}

function resolveCompany(template?: InvoiceTemplate) {
  return {
    name: getOrganizationCompanyName() || template?.branding.companyName || DEFAULT_COMPANY_PLACEHOLDER,
    address: getOrganizationAddress() || template?.branding.companyAddress || "",
    primaryColor: template?.branding.primaryColor || "#2563eb",
    logo: template?.branding.logo,
    branding: template?.branding,
  };
}

function ClassicLayout({ invoice, client, template, compact, showStatus }: InvoiceThemeViewProps) {
  const { name, address, primaryColor, logo, branding } = resolveCompany(template);

  return (
    <div style={{ fontFamily: branding?.fontFamily }} className={compact ? "text-xs" : "text-sm"}>
      <div
        className="flex justify-between items-start border-b-2 pb-4 mb-6"
        style={{ borderColor: primaryColor }}
      >
        <div>
          {branding?.sections.logo && logo && (
            <Image src={logo} alt="Logo" width={48} height={48} unoptimized className="h-10 w-auto mb-2" />
          )}
          <h1 className="text-xl font-bold" style={{ color: primaryColor }}>{name}</h1>
          <p className="text-muted-foreground">{address}</p>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-bold" style={{ color: primaryColor }}>INVOICE</h2>
          <p className="font-medium">{invoice.invoiceNumber}</p>
          {showStatus && <InvoiceStatusBadge status={invoice.status} />}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 mb-6">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Bill To</p>
          <p className="font-semibold">{client.name}</p>
          <p>{client.email}</p>
          <p>{client.address}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-sm">Issued: {formatDate(invoice.issueDate)}</p>
          <p className="text-sm">Due: {formatDate(invoice.dueDate)}</p>
        </div>
      </div>

      <InvoiceTable invoice={invoice} primaryColor={primaryColor} filledHeader />
      <InvoiceTotals invoice={invoice} primaryColor={primaryColor} />
      <InvoiceFooter branding={branding} invoice={invoice} />
    </div>
  );
}

function ModernLayout({ invoice, client, template, compact, showStatus }: InvoiceThemeViewProps) {
  const { name, address, primaryColor, logo, branding } = resolveCompany(template);

  return (
    <div style={{ fontFamily: branding?.fontFamily }} className={compact ? "text-xs" : "text-sm"}>
      <div
        className="rounded-lg px-6 py-5 mb-6 text-white flex justify-between items-start"
        style={{ backgroundColor: primaryColor }}
      >
        <div>
          {branding?.sections.logo && logo && (
            <Image src={logo} alt="Logo" width={40} height={40} unoptimized className="h-8 w-auto mb-2 brightness-0 invert" />
          )}
          <h1 className="text-lg font-bold">{name}</h1>
          <p className="text-white/80 text-xs mt-1">{address}</p>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold tracking-wide">INVOICE</h2>
          <p className="font-medium">{invoice.invoiceNumber}</p>
          {showStatus && <div className="mt-1"><InvoiceStatusBadge status={invoice.status} /></div>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Bill To</p>
          <p className="font-semibold">{client.name}</p>
          <p className="text-muted-foreground">{client.email}</p>
          <p className="text-muted-foreground">{client.address}</p>
        </div>
        <div className="rounded-lg p-4" style={{ backgroundColor: `${primaryColor}10` }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: primaryColor }}>Dates</p>
          <p>Issued: {formatDate(invoice.issueDate)}</p>
          <p>Due: {formatDate(invoice.dueDate)}</p>
        </div>
      </div>

      <InvoiceTable invoice={invoice} primaryColor={primaryColor} filledHeader />
      <InvoiceTotals invoice={invoice} primaryColor={primaryColor} boxed />
      <InvoiceFooter branding={branding} invoice={invoice} />
    </div>
  );
}

function MinimalLayout({ invoice, client, template, compact, showStatus }: InvoiceThemeViewProps) {
  const { name, address, primaryColor, logo, branding } = resolveCompany(template);

  return (
    <div style={{ fontFamily: branding?.fontFamily }} className={`${compact ? "text-xs" : "text-sm"} space-y-8`}>
      <div className="flex justify-between items-start">
        <div>
          {branding?.sections.logo && logo && (
            <Image src={logo} alt="Logo" width={32} height={32} unoptimized className="h-8 w-auto mb-3 opacity-80" />
          )}
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Invoice</p>
          <h2 className="text-3xl font-light mt-1">{invoice.invoiceNumber}</h2>
          {showStatus && <div className="mt-2"><InvoiceStatusBadge status={invoice.status} /></div>}
        </div>
        <div className="text-right text-muted-foreground">
          <p className="font-medium text-foreground">{name}</p>
          <p className="text-xs mt-1">{address}</p>
        </div>
      </div>

      <div className="grid gap-8 sm:grid-cols-2 border-t border-b py-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Bill To</p>
          <p className="font-medium">{client.name}</p>
          <p className="text-muted-foreground">{client.email}</p>
          <p className="text-muted-foreground">{client.address}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Payment Due</p>
          <p>{formatDate(invoice.dueDate)}</p>
          <p className="text-xs text-muted-foreground mt-2">Issued {formatDate(invoice.issueDate)}</p>
        </div>
      </div>

      <InvoiceTable invoice={invoice} primaryColor={primaryColor} filledHeader={false} />
      <InvoiceTotals invoice={invoice} primaryColor={primaryColor} minimal />
      <InvoiceFooter branding={branding} invoice={invoice} />
    </div>
  );
}

function InvoiceTable({
  invoice,
  primaryColor,
  filledHeader,
}: {
  invoice: Invoice;
  primaryColor: string;
  filledHeader: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr
            className={filledHeader ? "text-white" : "border-b-2"}
            style={filledHeader ? { backgroundColor: primaryColor } : { borderColor: primaryColor }}
          >
            <th className={`p-2 text-left ${filledHeader ? "" : "text-xs uppercase tracking-wider text-muted-foreground font-normal"}`}>Description</th>
            <th className={`p-2 text-right ${filledHeader ? "" : "text-xs uppercase tracking-wider text-muted-foreground font-normal"}`}>Qty</th>
            <th className={`p-2 text-right ${filledHeader ? "" : "text-xs uppercase tracking-wider text-muted-foreground font-normal"}`}>Price</th>
            <th className={`p-2 text-right ${filledHeader ? "" : "text-xs uppercase tracking-wider text-muted-foreground font-normal"}`}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item) => (
            <tr key={item.id} className="border-b border-muted">
              <td className="p-2">{item.description}</td>
              <td className="p-2 text-right">{item.quantity}</td>
              <td className="p-2 text-right">{formatCurrency(item.unitPrice)}</td>
              <td className="p-2 text-right">{formatCurrency(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvoiceTotals({
  invoice,
  primaryColor,
  boxed,
  minimal,
}: {
  invoice: Invoice;
  primaryColor: string;
  boxed?: boolean;
  minimal?: boolean;
}) {
  const content = (
    <>
      <div className="flex gap-8"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span></div>
      <div className="flex gap-8"><span className="text-muted-foreground">Tax</span><span>{formatCurrency(invoice.taxAmount)}</span></div>
      <div
        className={`flex gap-8 ${minimal ? "text-xl font-light" : "text-lg font-bold"}`}
        style={{ color: primaryColor }}
      >
        <span>Total</span><span>{formatCurrency(invoice.total)}</span>
      </div>
    </>
  );

  if (boxed) {
    return (
      <div className="mt-6 flex justify-end">
        <div className="rounded-lg border p-4 space-y-1 text-sm min-w-[220px]">{content}</div>
      </div>
    );
  }

  return <div className={`mt-6 flex flex-col items-end gap-1 text-sm ${minimal ? "space-y-2" : ""}`}>{content}</div>;
}

function InvoiceFooter({
  branding,
  invoice,
}: {
  branding?: InvoiceTemplate["branding"];
  invoice: Invoice;
}) {
  return (
    <>
      {branding?.sections.notes && invoice.notes && (
        <div className="mt-6 text-sm">
          <p className="text-xs uppercase text-muted-foreground mb-1">Notes</p>
          <p>{invoice.notes}</p>
        </div>
      )}
      {branding?.sections.paymentTerms && branding.paymentTerms && (
        <p className="mt-4 text-xs text-muted-foreground">{branding.paymentTerms}</p>
      )}
      {branding?.sections.footer && branding.footerText && (
        <p className="mt-8 text-center text-xs text-muted-foreground">{branding.footerText}</p>
      )}
    </>
  );
}

export function InvoiceThemeView(props: InvoiceThemeViewProps) {
  const theme: InvoiceTheme = props.template?.theme || "classic";

  switch (theme) {
    case "modern":
      return <ModernLayout {...props} />;
    case "minimal":
      return <MinimalLayout {...props} />;
    default:
      return <ClassicLayout {...props} />;
  }
}

export function InvoiceThemePreview({
  branding,
  theme = "classic",
  compact = false,
}: {
  branding: InvoiceTemplate["branding"];
  theme?: InvoiceTheme;
  compact?: boolean;
}) {
  const primaryColor = branding.primaryColor;

  if (theme === "modern") {
    return (
      <div style={{ fontFamily: branding.fontFamily }} className={compact ? "text-xs" : "text-sm"}>
        <div className="rounded-lg px-4 py-3 mb-3 text-white flex justify-between" style={{ backgroundColor: primaryColor }}>
          <div>
            <p className="font-bold">{branding.companyName}</p>
            <p className="text-white/70 text-xs">{branding.companyAddress}</p>
          </div>
          <p className="font-bold">INVOICE</p>
        </div>
        <div className="rounded border p-2 mb-2 text-muted-foreground">Bill To: Sample Client</div>
        <div className="h-5 rounded mb-1" style={{ backgroundColor: primaryColor }} />
        <div className="h-3 rounded bg-muted mb-1" />
        <div className="h-3 rounded bg-muted w-3/4" />
      </div>
    );
  }

  if (theme === "minimal") {
    return (
      <div style={{ fontFamily: branding.fontFamily }} className={`${compact ? "text-xs" : "text-sm"} space-y-3`}>
        <div className="flex justify-between border-b pb-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Invoice</p>
            <p className="text-lg font-light">INV-0000</p>
          </div>
          <p className="text-xs text-muted-foreground text-right">{branding.companyName}</p>
        </div>
        <div className="border-b pb-2">
          <div className="h-3 border-b border-muted mb-2" />
          <div className="h-3 bg-muted rounded w-full mb-1" />
          <div className="h-3 bg-muted rounded w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: branding.fontFamily }} className={compact ? "text-xs" : "text-sm"}>
      <div className="flex justify-between border-b-2 pb-3 mb-3" style={{ borderColor: primaryColor }}>
        <div>
          <p className="font-bold" style={{ color: primaryColor }}>{branding.companyName}</p>
          <p className="text-muted-foreground text-xs">{branding.companyAddress}</p>
        </div>
        <p className="font-bold" style={{ color: primaryColor }}>INVOICE</p>
      </div>
      <div className="h-5 rounded mb-1" style={{ backgroundColor: primaryColor, opacity: 0.15 }} />
      <div className="h-3 rounded bg-muted mb-1" />
      <div className="h-3 rounded bg-muted w-3/4" />
    </div>
  );
}
