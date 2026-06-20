import { getFromStorage, setInStorage } from "@/lib/mock-db/storage";
import { DEMO_USERS } from "@/lib/mock-db/auth";
import { seedTemplates } from "@/lib/mock-db/templates";
import { generateId } from "@/lib/utils";
import type {
  Client,
  Department,
  Employee,
  Invoice,
  OrganizationSettings,
} from "@/types";

const SEEDED_KEY = "seeded";

export function initializeSeedData(): void {
  if (typeof window === "undefined") return;
  if (getFromStorage<boolean>(SEEDED_KEY, false)) return;

  setInStorage("users", DEMO_USERS);
  seedTemplates();

  const templates = JSON.parse(
    localStorage.getItem("ipms_templates") || "[]"
  ) as { id: string; isDefault: boolean }[];
  const defaultTemplate = templates.find((t) => t.isDefault) || templates[0];

  const departments: Department[] = [
    {
      id: generateId(),
      name: "Engineering",
      description: "Software development and IT",
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId(),
      name: "Finance",
      description: "Accounting and financial operations",
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId(),
      name: "Human Resources",
      description: "People operations and recruitment",
      createdAt: new Date().toISOString(),
    },
  ];
  setInStorage("departments", departments);

  const clients: Client[] = [
    {
      id: generateId(),
      name: "Acme Corporation",
      email: "billing@acme.com",
      phone: "+1 555-0101",
      address: "456 Commerce St, Chicago, IL 60601",
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId(),
      name: "TechStart Inc",
      email: "accounts@techstart.io",
      phone: "+1 555-0102",
      address: "789 Innovation Blvd, Austin, TX 78701",
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId(),
      name: "Global Services Ltd",
      email: "finance@globalservices.com",
      phone: "+1 555-0103",
      address: "321 Enterprise Way, Seattle, WA 98101",
      createdAt: new Date().toISOString(),
    },
  ];
  setInStorage("clients", clients);

  const employees: Employee[] = [
    {
      id: generateId(),
      employeeId: "EMP-001",
      firstName: "John",
      lastName: "Developer",
      email: "john@dotcode.com",
      phone: "+1 555-0201",
      departmentId: departments[0].id,
      position: "Senior Developer",
      joinDate: "2023-01-15",
      status: "active",
      salaryStructure: {
        baseSalary: 8500,
        allowances: [
          { id: generateId(), name: "HRA", amount: 1200 },
          { id: generateId(), name: "Transport", amount: 300 },
        ],
        deductions: [
          { id: generateId(), name: "Tax", amount: 1500 },
          { id: generateId(), name: "Insurance", amount: 200 },
        ],
      },
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId(),
      employeeId: "EMP-002",
      firstName: "Emily",
      lastName: "Analyst",
      email: "emily@dotcode.com",
      phone: "+1 555-0202",
      departmentId: departments[1].id,
      position: "Financial Analyst",
      joinDate: "2023-06-01",
      status: "active",
      salaryStructure: {
        baseSalary: 7200,
        allowances: [
          { id: generateId(), name: "HRA", amount: 1000 },
          { id: generateId(), name: "Transport", amount: 250 },
        ],
        deductions: [
          { id: generateId(), name: "Tax", amount: 1200 },
          { id: generateId(), name: "Insurance", amount: 180 },
        ],
      },
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId(),
      employeeId: "EMP-003",
      firstName: "Michael",
      lastName: "Manager",
      email: "michael@dotcode.com",
      phone: "+1 555-0203",
      departmentId: departments[2].id,
      position: "HR Manager",
      joinDate: "2022-03-10",
      status: "active",
      salaryStructure: {
        baseSalary: 7800,
        allowances: [
          { id: generateId(), name: "HRA", amount: 1100 },
          { id: generateId(), name: "Transport", amount: 280 },
        ],
        deductions: [
          { id: generateId(), name: "Tax", amount: 1350 },
          { id: generateId(), name: "Insurance", amount: 190 },
        ],
      },
      createdAt: new Date().toISOString(),
    },
  ];
  setInStorage("employees", employees);

  const now = new Date();
  const invoices: Invoice[] = [
    {
      id: generateId(),
      invoiceNumber: "INV-0001",
      clientId: clients[0].id,
      items: [
        {
          id: generateId(),
          description: "Web Development Services",
          quantity: 40,
          unitPrice: 150,
          amount: 6000,
        },
        {
          id: generateId(),
          description: "UI/UX Design",
          quantity: 20,
          unitPrice: 120,
          amount: 2400,
        },
      ],
      subtotal: 8400,
      taxRate: 10,
      taxAmount: 840,
      total: 9240,
      status: "paid",
      templateId: defaultTemplate?.id || "",
      shareToken: generateId().replace(/-/g, "").slice(0, 16),
      issueDate: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString(),
      dueDate: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
      notes: "Thank you for your continued partnership.",
      history: [
        {
          id: generateId(),
          action: "Invoice created",
          timestamp: new Date().toISOString(),
        },
        {
          id: generateId(),
          action: "Status changed to paid",
          timestamp: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: generateId(),
      invoiceNumber: "INV-0002",
      clientId: clients[1].id,
      items: [
        {
          id: generateId(),
          description: "Consulting Services",
          quantity: 30,
          unitPrice: 200,
          amount: 6000,
        },
      ],
      subtotal: 6000,
      taxRate: 10,
      taxAmount: 600,
      total: 6600,
      status: "sent",
      templateId: defaultTemplate?.id || "",
      shareToken: generateId().replace(/-/g, "").slice(0, 16),
      issueDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      dueDate: new Date(now.getFullYear(), now.getMonth(), 28).toISOString(),
      history: [
        {
          id: generateId(),
          action: "Invoice created",
          timestamp: new Date().toISOString(),
        },
        {
          id: generateId(),
          action: "Status changed to sent",
          timestamp: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: generateId(),
      invoiceNumber: "INV-0003",
      clientId: clients[2].id,
      items: [
        {
          id: generateId(),
          description: "Annual Maintenance",
          quantity: 1,
          unitPrice: 12000,
          amount: 12000,
        },
      ],
      subtotal: 12000,
      taxRate: 10,
      taxAmount: 1200,
      total: 13200,
      status: "overdue",
      templateId: defaultTemplate?.id || "",
      shareToken: generateId().replace(/-/g, "").slice(0, 16),
      issueDate: new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString(),
      dueDate: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString(),
      history: [
        {
          id: generateId(),
          action: "Invoice created",
          timestamp: new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString(),
          userId: "system",
          userName: "System",
        },
        {
          id: generateId(),
          action: "Status changed to sent",
          timestamp: new Date(now.getFullYear(), now.getMonth() - 3, 5).toISOString(),
          userId: "system",
          userName: "System",
        },
        {
          id: generateId(),
          action: "Status changed to overdue",
          timestamp: new Date(now.getFullYear(), now.getMonth() - 2, 2).toISOString(),
          userId: "system",
          userName: "System",
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  setInStorage("invoices", invoices);

  const settings: OrganizationSettings = {
    id: "org-1",
    name: "DotCode Solutions",
    address: "123 Business Ave, Suite 100, New York, NY 10001",
    defaultTemplateId: defaultTemplate?.id || "",
  };
  setInStorage("settings", settings);

  setInStorage(SEEDED_KEY, true);
}
