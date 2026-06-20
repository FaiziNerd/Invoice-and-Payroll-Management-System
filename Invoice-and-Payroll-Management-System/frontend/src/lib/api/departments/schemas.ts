import { z } from "zod";

export const departmentFieldsSchema = z.object({
  name: z.string().trim().min(1, "Department name is required"),
  description: z.string(),
});

export const createDepartmentSchema = departmentFieldsSchema;

export const updateDepartmentSchema = departmentFieldsSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required" }
);
