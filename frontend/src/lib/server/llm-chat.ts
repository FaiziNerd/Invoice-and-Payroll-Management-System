const SYSTEM_PROMPT =
  'You suggest invoice line items. Respond with JSON only: {"items":[{"description":"...","quantity":1,"rate":100}]} — no markdown.';

export interface AiLineItem {
  description: string;
  quantity: number;
  rate: number;
}

type OpenAiCompatibleProvider = {
  label: string;
  url: string;
  apiKey: string;
  model: string;
};

function resolveOpenAiCompatibleProvider(): OpenAiCompatibleProvider | null {
  const xaiKey = process.env.XAI_API_KEY?.trim();
  if (xaiKey) {
    return {
      label: "xAI Grok",
      url: "https://api.x.ai/v1/chat/completions",
      apiKey: xaiKey,
      model: process.env.XAI_MODEL?.trim() || "grok-2-latest",
    };
  }

  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    return {
      label: "Groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: groqKey,
      model: process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile",
    };
  }

  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    return {
      label: "OpenAI",
      url: "https://api.openai.com/v1/chat/completions",
      apiKey: openAiKey,
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    };
  }

  return null;
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

async function callOpenAiCompatibleChat(
  provider: OpenAiCompatibleProvider,
  description: string
): Promise<AiLineItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(provider.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.3,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: description },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`${provider.label} error: ${res.status}`);
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

async function callAnthropic(description: string): Promise<AiLineItem[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("No Anthropic API key configured");
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
        model: process.env.ANTHROPIC_MODEL?.trim() || "claude-3-5-haiku-20241022",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
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

/** Provider priority: xAI Grok → Groq → OpenAI → Anthropic */
export async function callLlmForLineItems(description: string): Promise<AiLineItem[]> {
  const openAiCompatible = resolveOpenAiCompatibleProvider();
  if (openAiCompatible) {
    return callOpenAiCompatibleChat(openAiCompatible, description);
  }

  if (process.env.ANTHROPIC_API_KEY?.trim()) {
    return callAnthropic(description);
  }

  throw new Error("No AI API key configured");
}

export interface PayrollInsightItem {
  id: string;
  text: string;
  type: "warning" | "info" | "success";
}

const PAYROLL_INSIGHTS_PROMPT =
  'You analyze payroll data for a business dashboard. Respond with JSON only: {"insights":[{"id":"unique-id","text":"short actionable insight","type":"warning"|"info"|"success"}]} — no markdown. Provide 2-4 concise insights.';

function parsePayrollInsights(raw: string): PayrollInsightItem[] {
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  const parsed = JSON.parse(cleaned) as {
    insights?: Array<{ id?: string; text?: string; type?: string }>;
  };

  const insights = parsed.insights ?? [];
  if (!Array.isArray(insights) || insights.length === 0) {
    throw new Error("AI returned no payroll insights");
  }

  const validTypes = new Set(["warning", "info", "success"]);

  return insights.map((item, index) => ({
    id: String(item.id ?? `ai-${index}`),
    text: String(item.text ?? "Payroll insight"),
    type: validTypes.has(String(item.type))
      ? (item.type as PayrollInsightItem["type"])
      : "info",
  }));
}

async function callOpenAiCompatiblePayrollInsights(
  provider: OpenAiCompatibleProvider,
  summaryJson: string
): Promise<PayrollInsightItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(provider.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.3,
        messages: [
          { role: "system", content: PAYROLL_INSIGHTS_PROMPT },
          { role: "user", content: summaryJson },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`${provider.label} error: ${res.status}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");
    return parsePayrollInsights(content);
  } finally {
    clearTimeout(timeout);
  }
}

async function callAnthropicPayrollInsights(
  summaryJson: string
): Promise<PayrollInsightItem[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("No Anthropic API key configured");
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
        model: process.env.ANTHROPIC_MODEL?.trim() || "claude-3-5-haiku-20241022",
        max_tokens: 1024,
        system: PAYROLL_INSIGHTS_PROMPT,
        messages: [{ role: "user", content: summaryJson }],
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
    return parsePayrollInsights(text);
  } finally {
    clearTimeout(timeout);
  }
}

/** Provider priority: xAI Grok → Groq → OpenAI → Anthropic */
export async function callLlmForPayrollInsights(
  summaryJson: string
): Promise<PayrollInsightItem[]> {
  const openAiCompatible = resolveOpenAiCompatibleProvider();
  if (openAiCompatible) {
    return callOpenAiCompatiblePayrollInsights(openAiCompatible, summaryJson);
  }

  if (process.env.ANTHROPIC_API_KEY?.trim()) {
    return callAnthropicPayrollInsights(summaryJson);
  }

  throw new Error("No AI API key configured");
}
