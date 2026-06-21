import { writeFileSync } from "fs";
import { randomUUID } from "crypto";

const baseUrl = "{{baseUrl}}";

function request(name, method, path, opts = {}) {
  const url = {
    raw: `${baseUrl}${path}`,
    host: ["{{baseUrl}}"],
    path: path.replace(/^\//, "").split("/"),
  };
  if (opts.query) {
    url.query = opts.query.map(([key, value, description]) => ({
      key,
      value,
      ...(description ? { description } : {}),
    }));
  }
  const item = {
    name,
    request: {
      method,
      header: [{ key: "Content-Type", value: "application/json" }],
      url,
      description: opts.description ?? "",
    },
  };
  if (opts.body) {
    item.request.body = {
      mode: "raw",
      raw: JSON.stringify(opts.body, null, 2),
      options: { raw: { language: "json" } },
    };
  }
  return item;
}

function folder(name, items, description = "") {
  return { name, description, item: items };
}

const collection = {
  info: {
    _postman_id: randomUUID(),
    name: "IPMS - Invoice & Payroll Management API",
    description:
      "REST API collection for the Invoice & Payroll Management System (IPMS).\n\n" +
      "**Base URL:** Set `baseUrl` variable (default `http://localhost:3000`).\n\n" +
      "**Authentication:** Cookie-based Supabase session. After signup/login in the browser, copy session cookies into Postman, or call `POST /api/auth/signup` and use returned cookies.\n\n" +
      "**Demo credentials:** `demo@ipms.app` / `DemoIPMS2026!`\n\n" +
      "**Response format:** `{ \"success\": true, \"data\": ... }` or `{ \"success\": false, \"error\": { \"message\", \"code\" } }`\n\n" +
      "**Roles:** admin, accountant, hr, employee — endpoints enforce company-scoped access.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  variable: [
    { key: "baseUrl", value: "http://localhost:3000" },
    { key: "companyId", value: "" },
    { key: "clientId", value: "" },
    { key: "invoiceId", value: "" },
    { key: "employeeId", value: "" },
    { key: "departmentId", value: "" },
    { key: "payrollId", value: "" },
    { key: "entryId", value: "" },
    { key: "templateId", value: "" },
    { key: "shareToken", value: "" },
    { key: "inviteId", value: "" },
    { key: "userId", value: "" },
  ],
  item: [
    folder("Auth", [
      request("Signup (create company)", "POST", "/api/auth/signup", {
        description: "Create a new company and admin account.",
        body: {
          mode: "create",
          email: "admin@example.com",
          password: "password123",
          name: "Admin User",
          companyName: "Acme Corp",
        },
      }),
      request("Signup (join via invite)", "POST", "/api/auth/signup", {
        description: "Join an existing company using a 32+ char invite token.",
        body: {
          mode: "join",
          email: "user@example.com",
          password: "password123",
          name: "New User",
          inviteCode: "paste-invite-token-here-min-32-chars",
        },
      }),
      request("Get session", "GET", "/api/auth/session", {
        description: "Returns current user session and active company.",
      }),
      request("Logout", "POST", "/api/auth/logout"),
      request("Login audit", "POST", "/api/auth/login-audit", {
        description: "Records a login audit event (call after browser login).",
      }),
    ]),
    folder("Companies", [
      request("List companies", "GET", "/api/companies"),
      request("Switch active company", "POST", "/api/companies", {
        body: { companyId: "{{companyId}}" },
      }),
    ]),
    folder("Clients", [
      request("List clients", "GET", "/api/clients", {
        query: [
          ["limit", "25", "Page size (max 100)"],
          ["cursor", "", "Pagination cursor"],
          ["includeDeleted", "false"],
          ["trash", "false", "Trash only when true"],
        ],
      }),
      request("Create client", "POST", "/api/clients", {
        body: {
          name: "Acme Client",
          email: "client@acme.com",
          phone: "+1-555-0100",
          address: "123 Business Ave",
        },
      }),
      request("Get client", "GET", "/api/clients/{{clientId}}"),
      request("Update client", "PATCH", "/api/clients/{{clientId}}", {
        body: { name: "Acme Client Updated" },
      }),
      request("Delete client", "DELETE", "/api/clients/{{clientId}}"),
    ]),
    folder("Invoices", [
      request("List invoices", "GET", "/api/invoices", {
        query: [
          ["limit", "25"],
          ["cursor", ""],
        ],
      }),
      request("Create invoice", "POST", "/api/invoices", {
        body: {
          clientId: "{{clientId}}",
          items: [
            {
              description: "Consulting services",
              quantity: 10,
              unitPrice: 150,
              amount: 1500,
            },
          ],
          status: "draft",
          templateId: "{{templateId}}",
          issueDate: "2026-06-01",
          dueDate: "2026-06-30",
          notes: "Thank you for your business",
        },
      }),
      request("Get invoice", "GET", "/api/invoices/{{invoiceId}}"),
      request("Update invoice", "PATCH", "/api/invoices/{{invoiceId}}", {
        body: { notes: "Updated notes" },
      }),
      request("Delete invoice", "DELETE", "/api/invoices/{{invoiceId}}"),
      request("Next invoice number", "GET", "/api/invoices/next-number"),
      request("Patch invoice status", "PATCH", "/api/invoices/{{invoiceId}}/status", {
        body: { status: "sent", userName: "Admin" },
      }),
      request("Void invoice", "POST", "/api/invoices/{{invoiceId}}/void", {
        body: { reason: "Duplicate invoice" },
      }),
      request("List payments", "GET", "/api/invoices/{{invoiceId}}/payments"),
      request("Record payment", "POST", "/api/invoices/{{invoiceId}}/payments", {
        body: {
          amount: 500,
          method: "bank_transfer",
          referenceNumber: "TXN-001",
          paymentDate: "2026-06-15",
        },
      }),
      request("Send invoice email", "POST", "/api/invoices/{{invoiceId}}/send-email", {
        body: { mode: "send", userName: "Admin" },
      }),
      request("AI draft line items", "POST", "/api/invoices/ai-draft", {
        body: { description: "Website redesign project for 40 hours" },
      }),
      request("Resolve overdue invoices", "POST", "/api/invoices/resolve-overdue"),
    ]),
    folder("Payroll", [
      request("List payroll runs", "GET", "/api/payroll", {
        query: [
          ["limit", "25"],
          ["cursor", ""],
        ],
      }),
      request("Create payroll run", "POST", "/api/payroll", {
        body: { month: 6, year: 2026 },
      }),
      request("Get payroll run", "GET", "/api/payroll/{{payrollId}}"),
      request("Process payroll", "POST", "/api/payroll/{{payrollId}}/process"),
      request("Mark payroll paid", "POST", "/api/payroll/{{payrollId}}/paid"),
      request("Update payroll entry", "PATCH", "/api/payroll/{{payrollId}}/entries/{{entryId}}", {
        body: { bonus: 200 },
      }),
    ]),
    folder("Employees", [
      request("List employees", "GET", "/api/employees", {
        query: [
          ["limit", "25"],
          ["cursor", ""],
          ["includeDeleted", "false"],
          ["trash", "false"],
        ],
      }),
      request("Create employee", "POST", "/api/employees", {
        body: {
          employeeId: "EMP-001",
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@example.com",
          phone: "+1-555-0100",
          departmentId: "{{departmentId}}",
          position: "Software Engineer",
          joinDate: "2026-01-15T00:00:00.000Z",
          status: "active",
          salaryStructure: {
            baseSalary: 75000,
            allowances: [{ name: "Housing", amount: 500 }],
            deductions: [{ name: "Tax", amount: 200 }],
          },
        },
      }),
      request("Next employee ID", "GET", "/api/employees/next-id"),
      request("Get employee", "GET", "/api/employees/{{employeeId}}"),
      request("Update employee", "PATCH", "/api/employees/{{employeeId}}", {
        body: { position: "Senior Engineer" },
      }),
      request("Delete employee", "DELETE", "/api/employees/{{employeeId}}"),
    ]),
    folder("Departments", [
      request("List departments", "GET", "/api/departments"),
      request("Create department", "POST", "/api/departments", {
        body: { name: "Engineering", description: "Product development" },
      }),
      request("Get department", "GET", "/api/departments/{{departmentId}}"),
      request("Update department", "PATCH", "/api/departments/{{departmentId}}", {
        body: { description: "Updated description" },
      }),
      request("Delete department", "DELETE", "/api/departments/{{departmentId}}"),
    ]),
    folder("Salary Slips", [
      request("List salary slips", "GET", "/api/salary-slips", {
        query: [["runId", "{{payrollId}}", "Optional filter by payroll run"]],
      }),
      request("Generate salary slips", "POST", "/api/salary-slips/generate", {
        body: { runId: "{{payrollId}}" },
      }),
    ]),
    folder("Templates", [
      request("List templates", "GET", "/api/templates", {
        query: [
          ["limit", "25"],
          ["cursor", ""],
          ["includeDeleted", "false"],
          ["trash", "false"],
        ],
      }),
      request("Create template", "POST", "/api/templates", {
        body: {
          name: "Custom Invoice",
          isDefault: false,
          isActive: true,
          theme: "modern",
          branding: {
            primaryColor: "#2563eb",
            secondaryColor: "#1e40af",
            fontFamily: "Inter",
            sections: {
              logo: true,
              notes: true,
              paymentTerms: true,
              footer: true,
            },
            companyName: "Acme Corp",
            companyAddress: "123 Main St",
            paymentTerms: "Net 30",
            footerText: "Thank you",
          },
        },
      }),
      request("Get template", "GET", "/api/templates/{{templateId}}"),
      request("Update template", "PATCH", "/api/templates/{{templateId}}", {
        body: { name: "Updated Template" },
      }),
      request("Delete template", "DELETE", "/api/templates/{{templateId}}"),
      request("Publish template", "POST", "/api/templates/{{templateId}}/publish"),
      request("Duplicate template", "POST", "/api/templates/{{templateId}}/duplicate"),
    ]),
    folder("Settings & Tax", [
      request("Get organization settings", "GET", "/api/settings"),
      request("Update organization settings", "PATCH", "/api/settings", {
        body: {
          name: "Acme Corp",
          address: "123 Main St, City",
          defaultTemplateId: "{{templateId}}",
        },
      }),
      request("Get tax config", "GET", "/api/tax-config"),
      request("Update tax config", "PUT", "/api/tax-config", {
        body: { name: "Sales Tax", rate: 8.5, isInclusive: false },
      }),
    ]),
    folder("Admin", [
      request("List users", "GET", "/api/admin/users"),
      request("Create user", "POST", "/api/admin/users", {
        body: {
          name: "Accountant User",
          email: "accountant@example.com",
          password: "password123",
          role: "accountant",
        },
      }),
      request("Update user", "PATCH", "/api/admin/users", {
        body: { id: "{{userId}}", role: "hr" },
      }),
      request("Delete user", "DELETE", "/api/admin/users", {
        query: [["id", "{{userId}}"]],
      }),
      request("List pending members", "GET", "/api/admin/pending-members"),
      request("Approve pending member", "POST", "/api/admin/pending-members", {
        body: { userId: "{{userId}}" },
      }),
      request("Reject pending member", "DELETE", "/api/admin/pending-members", {
        query: [["userId", "{{userId}}"]],
      }),
    ]),
    folder("Invites", [
      request("List invites", "GET", "/api/invites"),
      request("Create invite", "POST", "/api/invites", {
        body: {
          email: "newuser@example.com",
          role: "accountant",
          expiresInDays: 7,
        },
      }),
      request("Revoke invite", "DELETE", "/api/invites", {
        query: [["id", "{{inviteId}}"]],
      }),
    ]),
    folder("Dashboard", [
      request("Dashboard analytics", "GET", "/api/dashboard/analytics"),
      request("Payroll insights AI", "GET", "/api/dashboard/payroll-insights-ai"),
    ]),
    folder("Portal (Employee)", [
      request("Employee portal profile", "GET", "/api/portal/me", {
        description: "Requires employee role with linked employee profile.",
      }),
    ]),
    folder("Audit", [
      request("List audit logs", "GET", "/api/audit-logs", {
        query: [
          ["page", "1"],
          ["limit", "50"],
        ],
      }),
      request("Record export audit", "POST", "/api/audit/export", {
        body: {
          entity: "payroll",
          description: "Exported payroll CSV",
          entityId: "{{payrollId}}",
        },
      }),
    ]),
    folder("Public", [
      request("Shared invoice (public)", "GET", "/api/shared/invoice/{{shareToken}}", {
        description: "No authentication required. Uses invoice share token.",
      }),
    ]),
    folder("Cron", [
      request("Invoice reminders (cron)", "GET", "/api/cron/invoice-reminders", {
        description: "Protected by CRON_SECRET header in production.",
        query: [["secret", "", "CRON_SECRET value"]],
      }),
    ]),
  ],
};

const outPath = new URL("./IPMS.postman_collection.json", import.meta.url);
writeFileSync(outPath, JSON.stringify(collection, null, 2));
console.log(`Wrote ${outPath.pathname}`);
