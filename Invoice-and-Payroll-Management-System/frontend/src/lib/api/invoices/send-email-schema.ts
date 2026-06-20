import { z } from "zod";

export const sendInvoiceEmailSchema = z.object({
  mode: z.enum(["send", "resend", "reminder"]),
  userName: z.string().trim().optional(),
});
