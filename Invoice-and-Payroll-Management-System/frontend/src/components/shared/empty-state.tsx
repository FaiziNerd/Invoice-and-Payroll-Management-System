import { FileText, Users, Palette, Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: "file" | "users" | "palette" | "inbox";
  title: string;
  description: string;
  action?: React.ReactNode;
}

const icons = {
  file: FileText,
  users: Users,
  palette: Palette,
  inbox: Inbox,
};

export function EmptyState({ icon = "inbox", title, description, action }: EmptyStateProps) {
  const Icon = icons[icon];
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
