"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
  Image,
} from "@react-pdf/renderer";
import type { Invoice, Client, InvoiceTemplate } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getOrganizationAddress, getOrganizationCompanyName } from "@/lib/repositories/settings";
import { DEFAULT_COMPANY_PLACEHOLDER } from "@/lib/branding";

function resolveCompany(template?: InvoiceTemplate) {
  return {
    name: getOrganizationCompanyName() || template?.branding.companyName || DEFAULT_COMPANY_PLACEHOLDER,
    address: getOrganizationAddress() || template?.branding.companyAddress || "",
    primaryColor: template?.branding.primaryColor || "#2563eb",
    branding: template?.branding,
  };
}

const baseStyles = (color: string) =>
  StyleSheet.create({
    page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
    label: { fontSize: 8, color: "#666", marginBottom: 3 },
    tableHeader: {
      flexDirection: "row",
      backgroundColor: color,
      color: "#fff",
      padding: 8,
      fontWeight: "bold",
    },
    tableHeaderMinimal: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: color,
      paddingBottom: 6,
      marginBottom: 4,
      color: "#666",
      fontSize: 8,
    },
    tableRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: "#eee",
      padding: 8,
    },
    col1: { width: "40%" },
    col2: { width: "15%", textAlign: "right" },
    col3: { width: "20%", textAlign: "right" },
    col4: { width: "25%", textAlign: "right" },
    totals: { marginTop: 15, alignItems: "flex-end" },
    totalRow: { flexDirection: "row", width: 200, justifyContent: "space-between", marginBottom: 4 },
    grandTotal: { fontSize: 14, fontWeight: "bold", color },
    footer: { position: "absolute", bottom: 30, left: 40, right: 40, textAlign: "center", fontSize: 8, color: "#999" },
    logo: { width: 60, height: 60, marginBottom: 8 },
  });

interface InvoicePDFProps {
  invoice: Invoice;
  client: Client;
  template?: InvoiceTemplate;
}

function InvoiceItemsTable({ invoice, styles, minimal }: { invoice: Invoice; styles: ReturnType<typeof baseStyles>; minimal?: boolean }) {
  const Header = minimal ? (
    <View style={styles.tableHeaderMinimal}>
      <Text style={styles.col1}>DESCRIPTION</Text>
      <Text style={styles.col2}>QTY</Text>
      <Text style={styles.col3}>PRICE</Text>
      <Text style={styles.col4}>AMOUNT</Text>
    </View>
  ) : (
    <View style={styles.tableHeader}>
      <Text style={styles.col1}>Description</Text>
      <Text style={styles.col2}>Qty</Text>
      <Text style={styles.col3}>Price</Text>
      <Text style={styles.col4}>Amount</Text>
    </View>
  );

  return (
    <View>
      {Header}
      {invoice.items.map((item) => (
        <View key={item.id} style={styles.tableRow}>
          <Text style={styles.col1}>{item.description}</Text>
          <Text style={styles.col2}>{item.quantity}</Text>
          <Text style={styles.col3}>{formatCurrency(item.unitPrice)}</Text>
          <Text style={styles.col4}>{formatCurrency(item.amount)}</Text>
        </View>
      ))}
    </View>
  );
}

function InvoiceTotalsSection({ invoice, styles }: { invoice: Invoice; styles: ReturnType<typeof baseStyles> }) {
  return (
    <View style={styles.totals}>
      <View style={styles.totalRow}><Text>Subtotal</Text><Text>{formatCurrency(invoice.subtotal)}</Text></View>
      <View style={styles.totalRow}><Text>Tax ({invoice.taxRate}%)</Text><Text>{formatCurrency(invoice.taxAmount)}</Text></View>
      <View style={[styles.totalRow, { marginTop: 8 }]}>
        <Text style={styles.grandTotal}>Total</Text>
        <Text style={styles.grandTotal}>{formatCurrency(invoice.total)}</Text>
      </View>
    </View>
  );
}

function ClassicPDF({ invoice, client, template }: InvoicePDFProps) {
  const { name, address, primaryColor, branding } = resolveCompany(template);
  const styles = baseStyles(primaryColor);

  return (
    <Page size="A4" style={styles.page}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 30, borderBottomWidth: 2, borderBottomColor: primaryColor, paddingBottom: 15 }}>
        <View>
          {branding?.sections.logo && branding.logo && (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={branding.logo} style={styles.logo} />
          )}
          <Text style={{ fontSize: 18, fontWeight: "bold", color: primaryColor }}>{name}</Text>
          <Text>{address}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", color: primaryColor }}>INVOICE</Text>
          <Text>{invoice.invoiceNumber}</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20 }}>
        <View style={{ marginBottom: 15 }}>
          <Text style={styles.label}>BILL TO</Text>
          <Text style={{ fontWeight: "bold" }}>{client.name}</Text>
          <Text>{client.email}</Text>
          <Text>{client.address}</Text>
        </View>
        <View style={{ marginBottom: 15 }}>
          <Text style={styles.label}>INVOICE DATE</Text>
          <Text>{formatDate(invoice.issueDate)}</Text>
          <Text style={[styles.label, { marginTop: 8 }]}>DUE DATE</Text>
          <Text>{formatDate(invoice.dueDate)}</Text>
        </View>
      </View>

      <InvoiceItemsTable invoice={invoice} styles={styles} />
      <InvoiceTotalsSection invoice={invoice} styles={styles} />
      {branding?.sections.notes && invoice.notes && (
        <View style={{ marginTop: 20 }}>
          <Text style={styles.label}>NOTES</Text>
          <Text>{invoice.notes}</Text>
        </View>
      )}
      {branding?.sections.paymentTerms && <View style={{ marginBottom: 12 }}><Text style={styles.label}>PAYMENT TERMS</Text><Text>{branding.paymentTerms}</Text></View>}
      {branding?.sections.footer && <Text style={styles.footer}>{branding.footerText}</Text>}
    </Page>
  );
}

function ModernPDF({ invoice, client, template }: InvoicePDFProps) {
  const { name, address, primaryColor, branding } = resolveCompany(template);
  const styles = baseStyles(primaryColor);

  return (
    <Page size="A4" style={styles.page}>
      <View style={{ backgroundColor: primaryColor, padding: 20, marginBottom: 24, borderRadius: 4, flexDirection: "row", justifyContent: "space-between" }}>
        <View>
          <Text style={{ fontSize: 16, fontWeight: "bold", color: "#fff" }}>{name}</Text>
          <Text style={{ color: "#ffffffcc", fontSize: 9, marginTop: 4 }}>{address}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 20, fontWeight: "bold", color: "#fff" }}>INVOICE</Text>
          <Text style={{ color: "#fff" }}>{invoice.invoiceNumber}</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20, gap: 16 }}>
        <View style={{ flex: 1, borderWidth: 1, borderColor: "#e5e7eb", padding: 12, borderRadius: 4 }}>
          <Text style={styles.label}>BILL TO</Text>
          <Text style={{ fontWeight: "bold" }}>{client.name}</Text>
          <Text>{client.email}</Text>
          <Text>{client.address}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: "#f8fafc", padding: 12, borderRadius: 4 }}>
          <Text style={[styles.label, { color: primaryColor }]}>DATES</Text>
          <Text>Issued: {formatDate(invoice.issueDate)}</Text>
          <Text>Due: {formatDate(invoice.dueDate)}</Text>
        </View>
      </View>

      <InvoiceItemsTable invoice={invoice} styles={styles} />
      <InvoiceTotalsSection invoice={invoice} styles={styles} />
      {branding?.sections.footer && <Text style={styles.footer}>{branding.footerText}</Text>}
    </Page>
  );
}

function MinimalPDF({ invoice, client, template }: InvoicePDFProps) {
  const { name, address, primaryColor, branding } = resolveCompany(template);
  const styles = baseStyles(primaryColor);

  return (
    <Page size="A4" style={[styles.page, { paddingTop: 50 }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 30 }}>
        <View>
          <Text style={{ fontSize: 8, letterSpacing: 2, color: "#999" }}>INVOICE</Text>
          <Text style={{ fontSize: 22, fontWeight: "normal", marginTop: 4 }}>{invoice.invoiceNumber}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontWeight: "bold" }}>{name}</Text>
          <Text style={{ fontSize: 8, color: "#666", marginTop: 4 }}>{address}</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#e5e7eb", paddingVertical: 16, marginBottom: 24 }}>
        <View>
          <Text style={{ fontSize: 8, letterSpacing: 2, color: "#999", marginBottom: 6 }}>BILL TO</Text>
          <Text style={{ fontWeight: "bold" }}>{client.name}</Text>
          <Text>{client.email}</Text>
          <Text>{client.address}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 8, letterSpacing: 2, color: "#999", marginBottom: 6 }}>PAYMENT DUE</Text>
          <Text>{formatDate(invoice.dueDate)}</Text>
          <Text style={{ fontSize: 8, color: "#999", marginTop: 6 }}>Issued {formatDate(invoice.issueDate)}</Text>
        </View>
      </View>

      <InvoiceItemsTable invoice={invoice} styles={styles} minimal />
      <InvoiceTotalsSection invoice={invoice} styles={styles} />
      {branding?.sections.footer && <Text style={styles.footer}>{branding.footerText}</Text>}
    </Page>
  );
}

function InvoicePDFDocument({ invoice, client, template }: InvoicePDFProps) {
  const theme = template?.theme || "classic";

  return (
    <Document>
      {theme === "modern" ? (
        <ModernPDF invoice={invoice} client={client} template={template} />
      ) : theme === "minimal" ? (
        <MinimalPDF invoice={invoice} client={client} template={template} />
      ) : (
        <ClassicPDF invoice={invoice} client={client} template={template} />
      )}
    </Document>
  );
}

export async function downloadInvoicePDF(
  invoice: Invoice,
  client: Client,
  template?: InvoiceTemplate
) {
  const blob = await pdf(
    <InvoicePDFDocument invoice={invoice} client={client} template={template} />
  ).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${invoice.invoiceNumber}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

export { InvoicePDFDocument };
