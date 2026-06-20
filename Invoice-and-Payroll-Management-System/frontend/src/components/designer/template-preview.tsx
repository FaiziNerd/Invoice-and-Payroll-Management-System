import type { TemplateBranding, InvoiceTemplate } from "@/types";
import { InvoiceThemePreview } from "@/components/invoices/invoice-theme-view";

export function TemplatePreview({
  branding,
  theme = "classic",
  compact = false,
}: {
  branding: TemplateBranding;
  theme?: InvoiceTemplate["theme"];
  compact?: boolean;
}) {
  return <InvoiceThemePreview branding={branding} theme={theme} compact={compact} />;
}
