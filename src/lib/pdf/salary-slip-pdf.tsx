"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import JSZip from "jszip";
import type { SalarySlip, Employee } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { getDefaultTemplate } from "@/lib/mock-db/templates";
import { getDepartmentById } from "@/lib/mock-db/departments";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  header: {
    textAlign: "center",
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
    paddingBottom: 15,
  },
  company: { fontSize: 16, fontWeight: "bold", color: "#2563eb" },
  title: { fontSize: 14, marginTop: 5 },
  section: { marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#2563eb",
    color: "#fff",
    padding: 6,
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    padding: 6,
  },
  col1: { width: "60%" },
  col2: { width: "40%", textAlign: "right" },
  netPay: {
    marginTop: 15,
    padding: 10,
    backgroundColor: "#f0f9ff",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  netPayText: { fontSize: 14, fontWeight: "bold", color: "#2563eb" },
});

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getSalarySlipCompanyName(): string {
  return getDefaultTemplate()?.branding.companyName || "DotCode Solutions";
}

function getEmployeeDepartmentName(employee: Employee): string {
  return getDepartmentById(employee.departmentId)?.name || "Unknown";
}

function getSalarySlipFilename(slip: SalarySlip, employee: Employee): string {
  return `salary-slip-${employee.employeeId}-${slip.month}-${slip.year}.pdf`;
}

interface SalarySlipPDFProps {
  slip: SalarySlip;
  employee: Employee;
  companyName?: string;
  departmentName?: string;
}

function SalarySlipPDFDocument({
  slip,
  employee,
  companyName = getSalarySlipCompanyName(),
  departmentName = getEmployeeDepartmentName(employee),
}: SalarySlipPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.company}>{companyName}</Text>
          <Text style={styles.title}>Salary Slip - {MONTHS[slip.month - 1]} {slip.year}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Text>Employee: {employee.firstName} {employee.lastName}</Text>
            <Text>ID: {employee.employeeId}</Text>
          </View>
          <View style={styles.row}>
            <Text>Department: {departmentName}</Text>
            <Text>Position: {employee.position}</Text>
          </View>
          <View style={styles.row}>
            <Text>Email: {employee.email}</Text>
          </View>
        </View>

        <Text style={{ fontWeight: "bold", marginBottom: 6 }}>Earnings</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.col1}>Component</Text>
          <Text style={styles.col2}>Amount</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.col1}>Base Salary</Text>
          <Text style={styles.col2}>{formatCurrency(slip.baseSalary)}</Text>
        </View>
        {slip.allowances.map((a) => (
          <View key={a.id} style={styles.tableRow}>
            <Text style={styles.col1}>{a.name}</Text>
            <Text style={styles.col2}>{formatCurrency(a.amount)}</Text>
          </View>
        ))}
        {slip.bonus > 0 && (
          <View style={styles.tableRow}>
            <Text style={styles.col1}>Bonus</Text>
            <Text style={styles.col2}>{formatCurrency(slip.bonus)}</Text>
          </View>
        )}

        <Text style={{ fontWeight: "bold", marginTop: 12, marginBottom: 6 }}>Deductions</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.col1}>Component</Text>
          <Text style={styles.col2}>Amount</Text>
        </View>
        {slip.deductions.map((d) => (
          <View key={d.id} style={styles.tableRow}>
            <Text style={styles.col1}>{d.name}</Text>
            <Text style={styles.col2}>{formatCurrency(d.amount)}</Text>
          </View>
        ))}
        {slip.oneOffDeduction > 0 && (
          <View style={styles.tableRow}>
            <Text style={styles.col1}>One-off Deduction</Text>
            <Text style={styles.col2}>{formatCurrency(slip.oneOffDeduction)}</Text>
          </View>
        )}

        <View style={styles.netPay}>
          <Text style={styles.netPayText}>Net Pay</Text>
          <Text style={styles.netPayText}>{formatCurrency(slip.netPay)}</Text>
        </View>
      </Page>
    </Document>
  );
}

async function generateSalarySlipPDFBlob(slip: SalarySlip, employee: Employee): Promise<Blob> {
  const companyName = getSalarySlipCompanyName();
  const departmentName = getEmployeeDepartmentName(employee);
  return pdf(
    <SalarySlipPDFDocument
      slip={slip}
      employee={employee}
      companyName={companyName}
      departmentName={departmentName}
    />
  ).toBlob();
}

export async function downloadSalarySlipPDF(slip: SalarySlip, employee: Employee) {
  const blob = await generateSalarySlipPDFBlob(slip, employee);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = getSalarySlipFilename(slip, employee);
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadSalarySlipsZip(
  items: { slip: SalarySlip; employee: Employee }[],
  zipFilename: string
) {
  const zip = new JSZip();

  for (const { slip, employee } of items) {
    const blob = await generateSalarySlipPDFBlob(slip, employee);
    zip.file(getSalarySlipFilename(slip, employee), blob);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = zipFilename;
  link.click();
  URL.revokeObjectURL(url);
}

export { SalarySlipPDFDocument };
