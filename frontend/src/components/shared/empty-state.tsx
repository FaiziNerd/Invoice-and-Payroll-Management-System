import {
  FileText,
  Users,
  Palette,
  Inbox,
  Wallet,
  Receipt,
  Building2,
  Activity,
  Shield,
  UserCircle,
  SearchX,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: "file" | "users" | "palette" | "inbox" | "wallet" | "receipt" | "building" | "activity" | "shield" | "employee" | "search";
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

const icons = {
  file: FileText,
  users: Users,
  palette: Palette,
  inbox: Inbox,
  wallet: Wallet,
  receipt: Receipt,
  building: Building2,
  activity: Activity,
  shield: Shield,
  employee: UserCircle,
  search: SearchX,
};

export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const Icon = icons[icon];

  return (
    <div className={cn("flex flex-col items-center justify-center py-14 text-center", className)}>
      <div className="empty-state-art mb-6" aria-hidden="true">
        <span className="empty-state-ring" />
        <span className="empty-state-ring empty-state-ring-delay" />
        <span className="empty-state-icon">
          <Icon className="h-7 w-7" />
        </span>
      </div>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
