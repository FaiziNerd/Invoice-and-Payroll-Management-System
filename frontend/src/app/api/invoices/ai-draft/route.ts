import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { requireCompanyContext } from "@/lib/api/require-company";
import { generateQuickDraftInvoice } from "@/lib/invoices/quick-draft-generator";
import {
  checkAiDraftRateLimit,
  recordAiDraftUsage,
} from "@/lib/server/ai-rate-limit";

const WRITE_ROLES = ["admin", "accountant"] as const;

const aiDraftSchema = z.object({
  description: z.string().trim().min(3, "Description is too short"),
});

interface AiLineItem {
  description: string;
  quantity: number;
  rate: number;
}

async function callLlmForLineItems(description: string): Promise<AiLineItem[]> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("No AI API key configured");
  }

  const useOpenAi = Boolean(process.env.OPENAI_API_KEY);
  const systemPrompt =
    "You suggest invoice line items. Respond with JSON only: {\"items\":[{\"description\":\"...\",\"quantity\":1,\"rate\":100}]} — no markdown.";

  if (useOpenAi) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          temperature: 0.3,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: description },
          ],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`OpenAI error: ${res.status}`);
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content;
      if (!content) throw new Error("Empty AI response");
      return parseAiItems(content);
    } finally {
      clearTimeout(timeout);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-20241022",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: description }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Anthropic error: ${res.status}`);
    }

    const json = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = json.content?.find((c) => c.type === "text")?.text;
    if (!text) throw new Error("Empty AI response");
    return parseAiItems(text);
  } finally {
    clearTimeout(timeout);
  }
}

function parseAiItems(raw: string): AiLineItem[] {
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  const parsed = JSON.parse(cleaned) as {
    items?: Array<{ description?: string; quantity?: number; rate?: number }>;
  };

  const items = parsed.items ?? [];
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("AI returned no items");
  }

  return items.map((item) => ({
    description: String(item.description ?? "Service"),
    quantity: Math.max(1, Number(item.quantity) || 1),
    rate: Math.max(0, Number(item.rate) || 0),
  }));
}

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
  let items: AiLineItem[];

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
