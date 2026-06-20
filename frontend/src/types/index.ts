export type UserRole = "admin" | "accountant" | "hr" | "employee";

export type MemberStatus = "active" | "pending";

export interface Company {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  createdAt: string;
}

export interface Session {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
  companyId: string;
  memberStatus: MemberStatus;
  employeeId?: string;
}

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "void";

export type PaymentMethod = "bank_transfer" | "cash" | "gateway";

export type PaymentVariance = "none" | "overpayment";

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  referenceNumber?: string;
  paymentDate: string;
  recordedBy: string;
  recordedByName?: string;
  proofUrl?: string;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  createdAt: string;
  deletedAt?: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  items: InvoiceLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  paymentVariance: PaymentVariance;
  status: InvoiceStatus;
  voidReason?: string;
  voidedAt?: string;
  templateId: string;
  shareToken: string;
  issueDate: string;
  dueDate: string;
  notes?: string;
  history: InvoiceHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceHistoryEntry {
  id: string;
  action: string;
  timestamp: string;
  userId?: string;
  userName?: string;
}

export interface InvoiceTemplate {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  theme: "classic" | "modern" | "minimal";
  branding: TemplateBranding;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface TemplateBranding {
  logo?: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  sections: {
    logo: boolean;
    notes: boolean;
    paymentTerms: boolean;
    footer: boolean;
  };
  companyName: string;
  companyAddress: string;
  paymentTerms: string;
  footerText: string;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export type EmployeeStatus = "active" | "inactive";

export interface SalaryAllowance {
  id: string;
  name: string;
  amount: number;
}

export interface SalaryDeduction {
  id: string;
  name: string;
  amount: number;
}

export interface SalaryStructure {
  baseSalary: number;
  allowances: SalaryAllowance[];
  deductions: SalaryDeduction[];
}

export interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  departmentId: string;
  position: string;
  joinDate: string;
  status: EmployeeStatus;
  salaryStructure: SalaryStructure;
  createdAt: string;
  deletedAt?: string;
  userId?: string;
}

export type PayrollStatus = "draft" | "processed" | "paid";

export interface PayrollEntry {
  id: string;
  employeeId: string;
  baseSalary: number;
  allowances: SalaryAllowance[];
  deductions: SalaryDeduction[];
  bonus: number;
  oneOffDeduction: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
}

export interface PayrollRun {
  id: string;
  month: number;
  year: number;
  status: PayrollStatus;
  entries: PayrollEntry[];
  totalGross: number;
  totalNet: number;
  processedAt?: string;
  createdAt: string;
}

export interface SalarySlip {
  id: string;
  payrollRunId: string;
  employeeId: string;
  month: number;
  year: number;
  baseSalary: number;
  allowances: SalaryAllowance[];
  deductions: SalaryDeduction[];
  bonus: number;
  oneOffDeduction: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  generatedAt: string;
}

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "send"
  | "process"
  | "export"
  | "status_change"
  | "void"
  | "payment";

export interface OrgTaxConfig {
  id?: string;
  name: string;
  rate: number;
  isInclusive: boolean;
  isActive: boolean;
  updatedAt?: string;
}

export interface AuditLog {
  id: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  userId: string;
  userName: string;
  description: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface OrganizationSettings {
  id: string;
  name: string;
  address: string;
  defaultTemplateId: string;
}
