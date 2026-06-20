import { z } from "zod";

/** Writable client fields — matches Omit<Client, "id" | "createdAt"> */
export const clientFieldsSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string(),
  address: z.string(),
});

export const createClientSchema = clientFieldsSchema;

export const updateClientSchema = clientFieldsSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required" }
);
