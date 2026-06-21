import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="border-l-2 border-primary/25 pl-4">
        <h1 className="text-2xl tracking-tight">{title}</h1>
        {description && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2 sm:shrink-0">{children}</div>}
    </div>
  );
}
