import { z } from "zod";

const salaryItemSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  amount: z.number().finite("Amount must be a valid number").min(0, "Amount cannot be negative"),
});

const salaryStructureSchema = z.object({
  baseSalary: z.number().finite("Base salary must be a valid number").min(0, "Base salary cannot be negative"),
  allowances: z.array(salaryItemSchema),
  deductions: z.array(salaryItemSchema),
});

/** Writable employee fields — matches Omit<Employee, "id" | "createdAt"> */
export const employeeFieldsSchema = z.object({
  employeeId: z.string().trim().min(1, "Employee ID is required"),
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string(),
  departmentId: z.string().uuid("Department is required"),
  position: z.string(),
  joinDate: z.string().datetime("Join date must be an ISO datetime"),
  status: z.enum(["active", "inactive"]),
  salaryStructure: salaryStructureSchema,
});

export const createEmployeeSchema = employeeFieldsSchema;

const updateSalaryStructureSchema = z
  .object({
    baseSalary: salaryStructureSchema.shape.baseSalary.optional(),
    allowances: salaryStructureSchema.shape.allowances.optional(),
    deductions: salaryStructureSchema.shape.deductions.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one salary structure field is required",
  });

export const updateEmployeeSchema = z
  .object({
    employeeId: employeeFieldsSchema.shape.employeeId.optional(),
    firstName: employeeFieldsSchema.shape.firstName.optional(),
    lastName: employeeFieldsSchema.shape.lastName.optional(),
    email: employeeFieldsSchema.shape.email.optional(),
    phone: employeeFieldsSchema.shape.phone.optional(),
    departmentId: employeeFieldsSchema.shape.departmentId.optional(),
    position: employeeFieldsSchema.shape.position.optional(),
    joinDate: employeeFieldsSchema.shape.joinDate.optional(),
    status: employeeFieldsSchema.shape.status.optional(),
    salaryStructure: updateSalaryStructureSchema.optional(),
    restore: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });
