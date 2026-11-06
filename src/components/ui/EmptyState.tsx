import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <span className="mb-1 grid size-10 place-items-center rounded-full bg-surface-muted text-ink-muted">
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-xs text-[13px] text-ink-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
