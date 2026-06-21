import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { generateQuickDraftInvoice } from "@/lib/invoices/quick-draft-generator";
import { callLlmForLineItems } from "@/lib/server/llm-chat";
import {
  checkAiDraftRateLimit,
  recordAiDraftUsage,
} from "@/lib/server/ai-rate-limit";

const WRITE_ROLES = ["admin", "accountant"] as const;

const aiDraftSchema = z.object({
  description: z.string().trim().min(3, "Description is too short"),
});

export async function POST(request: Request) {
  const result = await requireCompanyContext({ roles: [...WRITE_ROLES] });
  if ("error" in result) return result.error;
  const { supabase, companyId } = result.ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION_ERROR", "Invalid JSON body", 400);
  }

  const parsed = aiDraftSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.errors[0]?.message ?? "Invalid input",
      400
    );
  }

  const { allowed, remaining } = await checkAiDraftRateLimit(supabase, companyId);
  if (!allowed) {
    return fail(
      "RATE_LIMITED",
      "AI draft limit reached for this company. Try again later or use rule-based suggestions.",
      429
    );
  }

  const description = parsed.data.description;
  let source: "ai" | "rules" = "ai";
  let items: Awaited<ReturnType<typeof callLlmForLineItems>>;

  try {
    items = await callLlmForLineItems(description);
    await recordAiDraftUsage(supabase, companyId);
  } catch (err) {
    console.warn("[ai-draft] falling back to rules:", err);
    source = "rules";
    const fallback = generateQuickDraftInvoice(description, [], "");
    items = fallback.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      rate: item.unitPrice,
    }));
  }

  return ok({
    source,
    items,
    remaining: source === "ai" ? remaining - 1 : remaining,
  });
}
