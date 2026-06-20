import { z } from "zod";

export const createPayrollRunSchema = z.object({
  month: z.number().int("Month must be an integer").min(1).max(12),
  year: z.number().int("Year must be an integer").min(2000),
});

export const updatePayrollEntrySchema = z
  .object({
    bonus: z.number().finite("Bonus must be a valid number").min(0, "Bonus cannot be negative").optional(),
    oneOffDeduction: z
      .number()
      .finite("One-off deduction must be a valid number")
      .min(0, "One-off deduction cannot be negative")
      .optional(),
  })
  .refine((value) => value.bonus !== undefined || value.oneOffDeduction !== undefined, {
    message: "At least one field is required",
  });

export const generateSalarySlipsSchema = z.object({
  runId: z.string().uuid("runId must be a valid UUID"),
});
