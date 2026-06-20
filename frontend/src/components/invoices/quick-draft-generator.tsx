"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadClientsFromApi } from "@/lib/repositories/clients";
import { getDefaultTemplate } from "@/lib/repositories/templates";
import { generateQuickDraftInvoice } from "@/lib/invoices/quick-draft-generator";
import type { InvoiceFormValues } from "@/components/invoices/invoice-form";
import { generateId } from "@/lib/utils";

interface QuickDraftGeneratorProps {
  onGenerated: (values: InvoiceFormValues, summary: string) => void;
}

export function QuickDraftGenerator({ onGenerated }: QuickDraftGeneratorProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastSummary, setLastSummary] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/invoices/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ description: prompt.trim() }),
      });

      const clients = await loadClientsFromApi();
      const defaultTemplate = getDefaultTemplate();
      const templateId = defaultTemplate?.id || "";

      if (res.ok) {
        const json = (await res.json()) as {
          success: boolean;
          data?: {
            source: "ai" | "rules";
            items: Array<{ description: string; quantity: number; rate: number }>;
          };
        };

        if (json.success && json.data) {
          const items = json.data.items.map((item) => ({
            id: generateId(),
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.rate,
            amount: item.quantity * item.rate,
          }));

          const subtotal = items.reduce((s, i) => s + i.amount, 0);
          const ruleFallback = generateQuickDraftInvoice(prompt, clients, templateId);
          const summary =
            json.data.source === "ai"
              ? `AI suggested ${items.length} line item(s) totaling ~${subtotal.toLocaleString("en-US", { style: "currency", currency: "USD" })}.`
              : `Rule-based fallback: ${items.length} line item(s) (AI unavailable).`;

          const values: InvoiceFormValues = {
            clientId: ruleFallback.clientId,
            templateId,
            taxRate: ruleFallback.taxRate,
            dueDate: ruleFallback.dueDate,
            notes: ruleFallback.notes,
            items,
          };

          setLastSummary(summary);
          onGenerated(values, summary);
          return;
        }
      }

      const draft = generateQuickDraftInvoice(prompt, clients, templateId);
      const { summary, ...values } = draft;
      setLastSummary(`${summary} (rule-based fallback)`);
      onGenerated(values, summary);
    } catch {
      const clients = await loadClientsFromApi();
      const defaultTemplate = getDefaultTemplate();
      const draft = generateQuickDraftInvoice(
        prompt,
        clients,
        defaultTemplate?.id || ""
      );
      const { summary, ...values } = draft;
      setLastSummary(`${summary} (rule-based fallback)`);
      onGenerated(values, summary);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-dashed border-primary/40 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          AI-Powered Quick Draft
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          placeholder='Describe the invoice, e.g. "web design project, 3 revisions, rush delivery"'
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
        />
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={handleGenerate}
            disabled={!prompt.trim() || loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Suggest Line Items
              </>
            )}
          </Button>
          {lastSummary && (
            <p className="text-xs text-muted-foreground">{lastSummary}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
