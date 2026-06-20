import { Fragment } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1 text-sm", className)}>
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
          )}
          {item.href ? (
            <Link
              href={item.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium" aria-current="page">
              {item.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
