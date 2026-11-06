import { CloudCheck, LoaderCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/utils/cn";
import type { SaveState } from "../useDayLog";

export type Moment = "morning" | "day" | "evening";

export const MOMENTS: Record<Moment, { label: string; tone: string; ring: string }> = {
  morning: { label: "Por la mañana", tone: "bg-warning-soft text-warning", ring: "ring-warning/50" },
  day: { label: "Durante el día", tone: "bg-accent-soft text-accent", ring: "ring-accent/50" },
  evening: { label: "Al cerrar el día", tone: "bg-[#AF52DE]/12 text-[#AF52DE]", ring: "ring-[#AF52DE]/50" },
};

/** Momento del día según la hora: el plan por la mañana, los bloqueos de día, los aprendizajes al final. */
export function currentMoment(now = new Date()): Moment {
  const hour = now.getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "day";
  return "evening";
}

interface MomentCardProps {
  moment: Moment;
  icon: LucideIcon;
  title: string;
  question: string;
  /** Resaltar como el momento actual (solo en el día de hoy). */
  current: boolean;
  saveState?: SaveState;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function SaveIndicator({ state }: { state?: SaveState }) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
        <LoaderCircle className="size-3 animate-spin" /> Guardando
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success">
        <CloudCheck className="size-3.5" /> Guardado
      </span>
    );
  }
  if (state === "error") return <span className="text-xs text-danger">No se pudo guardar</span>;
  return null;
}

/** Tarjeta de uno de los momentos del check-in, con su franja horaria y estado de guardado. */
export function MomentCard({ moment, icon: Icon, title, question, current, saveState, action, className, children }: MomentCardProps) {
  const meta = MOMENTS[moment];
  return (
    <section
      aria-label={title}
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card transition-shadow",
        current && `ring-2 ${meta.ring}`,
        className,
      )}
    >
      <header className="flex items-start gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", meta.tone)}>
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[16px] font-semibold tracking-tight">{title}</h2>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", meta.tone)}>{meta.label}</span>
            {current && <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-medium text-surface">Ahora</span>}
          </div>
          <p className="mt-0.5 text-[13px] text-ink-muted">{question}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3 pt-1">
          <SaveIndicator state={saveState} />
          {action}
        </div>
      </header>
      {children}
    </section>
  );
}
