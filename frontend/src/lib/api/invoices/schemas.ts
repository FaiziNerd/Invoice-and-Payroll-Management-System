import { z } from "zod";

export const invoiceItemSchema = z.object({
  id: z.string().optional(),
  description: z.string().trim().min(1, "Item description is required"),
  quantity: z.number().finite().positive("Quantity must be greater than 0"),
  unitPrice: z.number().finite().min(0, "Unit price cannot be negative"),
  amount: z.number().finite().min(0, "Amount cannot be negative"),
});

const invoiceFieldsSchema = z.object({
  invoiceNumber: z.string().trim().min(1, "Invoice number is required"),
  clientId: z.string().trim().min(1, "Client is required"),
  items: z.array(invoiceItemSchema).min(1, "At least one line item is required"),
  taxRate: z.number().finite().min(0, "Tax rate cannot be negative"),
  status: z.enum(["draft", "sent", "paid", "overdue"]),
  templateId: z.string().trim().min(1, "Template is required"),
  issueDate: z.string().trim().min(1, "Issue date is required"),
  dueDate: z.string().trim().min(1, "Due date is required"),
  notes: z.string().optional(),
  userName: z.string().trim().optional(),
  historyAction: z.string().trim().optional(),
});

export const createInvoiceSchema = invoiceFieldsSchema;

export const updateInvoiceSchema = invoiceFieldsSchema
  .omit({ invoiceNumber: true, clientId: true, status: true, issueDate: true })
  .partial()
  .extend({
    clientId: z.string().trim().optional(),
    status: z.enum(["draft", "sent", "paid", "overdue"]).optional(),
    issueDate: z.string().trim().optional(),
    invoiceNumber: z.string().trim().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const patchInvoiceStatusSchema = z.object({
  status: z.enum(["draft", "sent", "paid", "overdue"]),
  userName: z.string().trim().optional(),
});
