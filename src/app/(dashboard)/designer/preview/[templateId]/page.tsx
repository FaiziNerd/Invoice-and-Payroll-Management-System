"use client";

import { use } from "react";
import Link from "next/link";
import { getTemplateById } from "@/lib/mock-db/templates";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export default function TemplatePreviewPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = use(params);
  const template = getTemplateById(templateId);

  if (!template) {
    return <p className="text-center py-20">Template not found</p>;
  }

  const { branding } = template;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Preview: {template.name}</h1>
        <Button variant="outline" asChild>
          <Link href={`/designer/${template.id}`}>Back to Editor</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="text-sm text-muted-foreground mb-2">Desktop Preview</p>
          <Card>
            <CardContent className="p-8">
              <InvoicePreview branding={branding} />
            </CardContent>
          </Card>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-2">Mobile Preview</p>
          <Card className="max-w-sm mx-auto">
            <CardContent className="p-4">
              <InvoicePreview branding={branding} compact />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import type { TemplateBranding } from "@/types";

function InvoicePreview({
  branding,
  compact = false,
}: {
  branding: TemplateBranding;
  compact?: boolean;
}) {
  return (
    <div style={{ fontFamily: branding.fontFamily }} className={compact ? "text-xs" : "text-sm"}>
      <div
        className="flex justify-between border-b-2 pb-4 mb-4"
        style={{ borderColor: branding.primaryColor }}
      >
        <div>
          {branding.sections.logo && branding.logo && (
            <img src={branding.logo} alt="Logo" className={compact ? "h-6 mb-1" : "h-10 mb-2"} />
          )}
          <p className="font-bold" style={{ color: branding.primaryColor }}>
            {branding.companyName}
          </p>
          <p className="text-muted-foreground">{branding.companyAddress}</p>
        </div>
        <p className="font-bold" style={{ color: branding.primaryColor }}>INVOICE</p>
      </div>
      <div className="mb-4">
        <p className="text-muted-foreground">Bill To: Sample Client</p>
      </div>
      <table className="w-full">
        <thead>
          <tr style={{ backgroundColor: branding.primaryColor }} className="text-white">
            <th className="p-1 text-left">Item</th>
            <th className="p-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b"><td className="p-1">Web Development</td><td className="p-1 text-right">{formatCurrency(5000)}</td></tr>
          <tr className="border-b"><td className="p-1">Design Services</td><td className="p-1 text-right">{formatCurrency(2000)}</td></tr>
        </tbody>
      </table>
      <div className="mt-4 text-right font-bold" style={{ color: branding.primaryColor }}>
        Total: {formatCurrency(7000)}
      </div>
      {branding.sections.footer && (
        <p className="mt-4 text-center text-muted-foreground">{branding.footerText}</p>
      )}
    </div>
  );
}
