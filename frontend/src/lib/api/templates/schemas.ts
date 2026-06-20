import { z } from "zod";

const brandingSchema = z.object({
  logo: z.string().optional(),
  primaryColor: z.string().trim().min(1, "Primary color is required"),
  secondaryColor: z.string().trim().min(1, "Secondary color is required"),
  fontFamily: z.string().trim().min(1, "Font family is required"),
  sections: z.object({
    logo: z.boolean(),
    notes: z.boolean(),
    paymentTerms: z.boolean(),
    footer: z.boolean(),
  }),
  companyName: z.string().trim().min(1, "Company name is required"),
  companyAddress: z.string(),
  paymentTerms: z.string(),
  footerText: z.string(),
});

export const templateFieldsSchema = z.object({
  name: z.string().trim().min(1, "Template name is required"),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  theme: z.enum(["classic", "modern", "minimal"]),
  branding: brandingSchema,
});

export const createTemplateSchema = templateFieldsSchema;

export const updateTemplateSchema = templateFieldsSchema
  .partial()
  .extend({ restore: z.boolean().optional() })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });
