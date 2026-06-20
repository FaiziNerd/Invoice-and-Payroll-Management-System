"use client";

import { useState } from "react";
import { Wand2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadClientsFromApi } from "@/lib/repositories/clients";
import { getDefaultTemplate } from "@/lib/repositories/templates";
import { generateQuickDraftInvoice } from "@/lib/invoices/quick-draft-generator";
import type { InvoiceFormValues } from "@/components/invoices/invoice-form";

interface QuickDraftGeneratorProps {
  onGenerated: (values: InvoiceFormValues, summary: string) => void;
}

export function QuickDraftGenerator({ onGenerated }: QuickDraftGeneratorProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastSummary, setLastSummary] = useState<string | null>(null);

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setLoading(true);

    void loadClientsFromApi().then((clients) => {
      const defaultTemplate = getDefaultTemplate();
      const draft = generateQuickDraftInvoice(
        prompt,
        clients,
        defaultTemplate?.id || ""
      );
      const { summary, ...values } = draft;
      setLastSummary(summary);
      onGenerated(values, summary);
      setLoading(false);
    });
  };

  return (
    <Card className="border-dashed border-primary/40 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wand2 className="h-4 w-4 text-primary" />
          Quick Draft Suggestions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          placeholder='Describe the invoice, e.g. "Web development and UI design for a client, net 30"'
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
                <Loader2 className="h-4 w-4 animate-spin" /> Suggesting…
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" /> Suggest Line Items
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
