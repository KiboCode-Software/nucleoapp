import type { LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";
import { surface, usePanelStyle } from "./surface";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: "accent" | "success" | "warning";
}

const iconTones = {
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
};

export function StatCard({ label, value, icon: Icon, tone = "accent" }: StatCardProps) {
  const panelStyle = usePanelStyle();
  const look = surface(panelStyle);
  return (
    <div
      className={cn("flex items-center gap-4 rounded-2xl", panelStyle?.density === "compact" ? "p-3" : "p-4", look.className)}
      style={look.style}
    >
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", iconTones[tone])}>
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
        <p className="text-[13px] leading-snug text-ink-muted">{label}</p>
      </div>
    </div>
  );
}
