import type { ReactNode } from "react";

export function MobilePreviewFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[220px]">
      <div className="rounded-[1.75rem] border-4 border-muted bg-muted/30 p-2 shadow-sm">
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-muted-foreground/20" />
        <div className="rounded-xl border bg-background p-3">{children}</div>
      </div>
    </div>
  );
}
