import type { TemplateBranding } from "@/types";

export function TemplatePreview({
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
      <div className="space-y-2">
        <div className="h-5 rounded" style={{ backgroundColor: branding.primaryColor, opacity: 0.1 }} />
        <div className="h-3 rounded bg-muted" />
        <div className="h-3 rounded bg-muted w-3/4" />
      </div>
      {branding.sections.paymentTerms && (
        <p className="text-xs mt-4 text-muted-foreground">{branding.paymentTerms}</p>
      )}
      {branding.sections.footer && (
        <p className="text-xs mt-4 text-center text-muted-foreground">{branding.footerText}</p>
      )}
    </div>
  );
}
