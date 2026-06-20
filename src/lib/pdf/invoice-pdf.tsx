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

const createStyles = (template?: InvoiceTemplate) =>
  StyleSheet.create({
    page: {
      padding: 40,
      fontSize: 10,
      fontFamily: "Helvetica",
      color: "#1a1a1a",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 30,
      borderBottomWidth: 2,
      borderBottomColor: template?.branding.primaryColor || "#2563eb",
      paddingBottom: 15,
    },
    companyName: {
      fontSize: 18,
      fontWeight: "bold",
      color: template?.branding.primaryColor || "#2563eb",
    },
    invoiceTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: template?.branding.primaryColor || "#2563eb",
    },
    section: { marginBottom: 15 },
    label: { fontSize: 8, color: "#666", marginBottom: 3 },
    row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
    tableHeader: {
      flexDirection: "row",
      backgroundColor: template?.branding.primaryColor || "#2563eb",
      color: "#fff",
      padding: 8,
      fontWeight: "bold",
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
    grandTotal: { fontSize: 14, fontWeight: "bold", color: template?.branding.primaryColor || "#2563eb" },
    footer: { position: "absolute", bottom: 30, left: 40, right: 40, textAlign: "center", fontSize: 8, color: "#999" },
    logo: { width: 60, height: 60, marginBottom: 8 },
  });

interface InvoicePDFProps {
  invoice: Invoice;
  client: Client;
  template?: InvoiceTemplate;
}

function InvoicePDFDocument({ invoice, client, template }: InvoicePDFProps) {
  const styles = createStyles(template);
  const branding = template?.branding;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            {branding?.sections.logo && branding.logo && (
              // @react-pdf Image is not an HTML img element
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={branding.logo} style={styles.logo} />
            )}
            <Text style={styles.companyName}>
              {branding?.companyName || "DotCode Solutions"}
            </Text>
            <Text>{branding?.companyAddress || ""}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text>{invoice.invoiceNumber}</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20 }}>
          <View style={styles.section}>
            <Text style={styles.label}>BILL TO</Text>
            <Text style={{ fontWeight: "bold" }}>{client.name}</Text>
            <Text>{client.email}</Text>
            <Text>{client.address}</Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>INVOICE DATE</Text>
            <Text>{formatDate(invoice.issueDate)}</Text>
            <Text style={[styles.label, { marginTop: 8 }]}>DUE DATE</Text>
            <Text>{formatDate(invoice.dueDate)}</Text>
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.col1}>Description</Text>
          <Text style={styles.col2}>Qty</Text>
          <Text style={styles.col3}>Price</Text>
          <Text style={styles.col4}>Amount</Text>
        </View>
        {invoice.items.map((item) => (
          <View key={item.id} style={styles.tableRow}>
            <Text style={styles.col1}>{item.description}</Text>
            <Text style={styles.col2}>{item.quantity}</Text>
            <Text style={styles.col3}>{formatCurrency(item.unitPrice)}</Text>
            <Text style={styles.col4}>{formatCurrency(item.amount)}</Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Subtotal</Text>
            <Text>{formatCurrency(invoice.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Tax ({invoice.taxRate}%)</Text>
            <Text>{formatCurrency(invoice.taxAmount)}</Text>
          </View>
          <View style={[styles.totalRow, { marginTop: 8 }]}>
            <Text style={styles.grandTotal}>Total</Text>
            <Text style={styles.grandTotal}>{formatCurrency(invoice.total)}</Text>
          </View>
        </View>

        {branding?.sections.notes && invoice.notes && (
          <View style={[styles.section, { marginTop: 20 }]}>
            <Text style={styles.label}>NOTES</Text>
            <Text>{invoice.notes}</Text>
          </View>
        )}

        {branding?.sections.paymentTerms && (
          <View style={styles.section}>
            <Text style={styles.label}>PAYMENT TERMS</Text>
            <Text>{branding.paymentTerms}</Text>
          </View>
        )}

        {branding?.sections.footer && (
          <Text style={styles.footer}>{branding.footerText}</Text>
        )}
      </Page>
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
